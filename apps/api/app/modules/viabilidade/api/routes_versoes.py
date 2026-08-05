"""Tela 7 — Cenários / What-If / Versões. docs/api-spec-viabilidade.md seção 8."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from .. import mapping, repository
from ..schemas.common import ErrorCode
from ..schemas.versoes import (
    ComparacaoMetricas,
    ComparacaoRequest,
    ComparacaoResponse,
    SnapshotCreateRequest,
    SnapshotResponse,
    VersaoCreateRequest,
    VersaoDeleteResponse,
    VersaoRenameRequest,
    VersaoResponse,
    WhatIfRequest,
    WhatIfResponse,
)
from ..services.metricas import MetricasResumo, calcular_metricas_resumo
from ..services.motor import calcular_projeto
from ..services.whatif_engine import simular_whatif
from .deps import CurrentUser, get_current_user, require_owner_or_executor

router = APIRouter(prefix="/api/v1/contratos/{contrato_id}", tags=["versoes"])


def _erro(status_code: int, error_code: ErrorCode | str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error_code": str(error_code), "message": message})


def _validar_versao_pertence_ao_contrato(versao: dict, contrato_id: UUID) -> None:
    """Defesa contra confused-deputy: get_versao_or_404 já garante que a versão
    pertence à organização do usuário, mas não que pertence ao `contrato_id` do
    path — sem esta checagem, um contrato_id trocado (mesmo dentro da mesma
    organização) poderia acionar invariantes (ex: "última versão") calculadas
    sobre o contrato errado."""
    if str(versao["contrato_id"]) != str(contrato_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NAO_ENCONTRADO", "message": "Versão não encontrada neste contrato."},
        )


def _metricas_para_schema(metricas: MetricasResumo) -> ComparacaoMetricas:
    return ComparacaoMetricas(
        receita_bruta=metricas.receita_bruta,
        impostos=metricas.impostos,
        receita_liquida=metricas.receita_liquida,
        custos_totais=metricas.custos_totais,
        ebitda=metricas.ebitda,
        margem_ebitda=metricas.margem_ebitda or 0,
        payback_mes=metricas.payback_mes,
    )


@router.post("/versoes", response_model=VersaoResponse, status_code=status.HTTP_201_CREATED)
def criar_versao(
    contrato_id: UUID, payload: VersaoCreateRequest, current_user: CurrentUser = Depends(require_owner_or_executor)
):
    repository.get_contrato_or_404(contrato_id, current_user.organization_id)
    if payload.origem_versao_id:
        versao_origem = repository.get_versao_or_404(payload.origem_versao_id, current_user.organization_id)
        _validar_versao_pertence_ao_contrato(versao_origem, contrato_id)

    versao = repository.criar_versao(contrato_id, current_user.user_id, payload.nome_versao, payload.origem_versao_id)
    vinculos = repository.listar_vinculos_modulo(contrato_id)
    return VersaoResponse(
        id=versao["id"],
        contrato_id=contrato_id,
        nome_versao=versao["nome_versao"],
        origem_versao_id=versao.get("origem_versao_id"),
        criado_por=versao["created_by"],
        created_at=versao["created_at"],
        vinculo_precificacao_ativo=any(v["modulo"] == "precificacao" for v in vinculos),
    )


@router.get("/versoes", response_model=list[VersaoResponse])
def listar_versoes(contrato_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    repository.get_contrato_or_404(contrato_id, current_user.organization_id)
    vinculos = repository.listar_vinculos_modulo(contrato_id)
    vinculo_precificacao_ativo = any(v["modulo"] == "precificacao" for v in vinculos)
    return [
        VersaoResponse(
            id=v["id"],
            contrato_id=contrato_id,
            nome_versao=v["nome_versao"],
            origem_versao_id=v.get("origem_versao_id"),
            criado_por=v["created_by"],
            created_at=v["created_at"],
            vinculo_precificacao_ativo=vinculo_precificacao_ativo,
        )
        for v in repository.listar_versoes(contrato_id)
    ]


@router.patch("/versoes/{versao_id}", response_model=VersaoResponse)
def renomear_versao(
    contrato_id: UUID, versao_id: UUID, payload: VersaoRenameRequest, current_user: CurrentUser = Depends(require_owner_or_executor)
):
    versao = repository.get_versao_or_404(versao_id, current_user.organization_id)
    _validar_versao_pertence_ao_contrato(versao, contrato_id)
    atualizada = repository.renomear_versao(versao_id, payload.nome_versao)
    vinculos = repository.listar_vinculos_modulo(contrato_id)
    return VersaoResponse(
        id=atualizada["id"],
        contrato_id=contrato_id,
        nome_versao=atualizada["nome_versao"],
        origem_versao_id=atualizada.get("origem_versao_id"),
        criado_por=atualizada["created_by"],
        created_at=atualizada["created_at"],
        vinculo_precificacao_ativo=any(v["modulo"] == "precificacao" for v in vinculos),
    )


@router.delete("/versoes/{versao_id}", response_model=VersaoDeleteResponse)
def excluir_versao(contrato_id: UUID, versao_id: UUID, current_user: CurrentUser = Depends(require_owner_or_executor)):
    versao = repository.get_versao_or_404(versao_id, current_user.organization_id)
    _validar_versao_pertence_ao_contrato(versao, contrato_id)

    if repository.contar_versoes(contrato_id) <= 1:
        raise _erro(
            status.HTTP_409_CONFLICT,
            ErrorCode.VERSAO_UNICA_NAO_EXCLUIVEL,
            "Não é possível excluir a única versão restante do projeto.",
        )

    repository.excluir_versao(versao_id)

    restantes = repository.listar_versoes(contrato_id)
    versao_substituta_id = UUID(restantes[0]["id"]) if restantes else None
    return VersaoDeleteResponse(versao_id_excluida=versao_id, versao_substituta_id=versao_substituta_id)


@router.post("/comparacoes", response_model=ComparacaoResponse)
def comparar_versoes(contrato_id: UUID, payload: ComparacaoRequest, current_user: CurrentUser = Depends(get_current_user)):
    versao_a, _, dados_a = mapping.carregar_calc_por_versao_id(payload.versao_a_id, current_user.organization_id)
    versao_b, _, dados_b = mapping.carregar_calc_por_versao_id(payload.versao_b_id, current_user.organization_id)
    _validar_versao_pertence_ao_contrato(versao_a, contrato_id)
    _validar_versao_pertence_ao_contrato(versao_b, contrato_id)

    resultado_a = calcular_projeto(*dados_a)
    resultado_b = calcular_projeto(*dados_b)

    return ComparacaoResponse(
        versao_a=_metricas_para_schema(calcular_metricas_resumo(resultado_a)),
        versao_b=_metricas_para_schema(calcular_metricas_resumo(resultado_b)),
    )


@router.post("/whatif", response_model=WhatIfResponse)
def simular_what_if(contrato_id: UUID, payload: WhatIfRequest, current_user: CurrentUser = Depends(get_current_user)):
    versao_base, _, (receitas, custos, despesas, parametros, projeto) = mapping.carregar_calc_por_versao_id(
        payload.versao_base_id, current_user.organization_id
    )
    _validar_versao_pertence_ao_contrato(versao_base, contrato_id)

    metricas_base, metricas_simuladas = simular_whatif(
        receitas,
        custos,
        despesas,
        parametros,
        projeto,
        ajuste_receita_pct=payload.ajuste_receita_pct,
        ajuste_custo_pct=payload.ajuste_custo_pct,
        ajuste_volumetria_receita_pct=payload.ajuste_volumetria_receita_pct,
    )

    return WhatIfResponse(
        versao_base=_metricas_para_schema(metricas_base),
        resultado_simulado=_metricas_para_schema(metricas_simuladas),
        ajustes_aplicados=payload,
    )


@router.post("/snapshots", response_model=SnapshotResponse, status_code=status.HTTP_201_CREATED)
def salvar_snapshot(
    contrato_id: UUID, payload: SnapshotCreateRequest, current_user: CurrentUser = Depends(require_owner_or_executor)
):
    repository.get_contrato_or_404(contrato_id, current_user.organization_id)

    # Sem esta checagem, um payload com versao_a_id/versao_b_id de outra organização
    # seria aceito silenciosamente (o FK apenas exige que a versão exista em algum
    # lugar do banco, não que pertença a este tenant) — validar explicitamente que
    # cada versão referenciada pertence ao próprio usuário e a este contrato.
    versao_a = repository.get_versao_or_404(payload.versao_a_id, current_user.organization_id)
    _validar_versao_pertence_ao_contrato(versao_a, contrato_id)
    if payload.versao_b_id:
        versao_b = repository.get_versao_or_404(payload.versao_b_id, current_user.organization_id)
        _validar_versao_pertence_ao_contrato(versao_b, contrato_id)

    dados = {
        "tipo": payload.tipo.value,
        "nome": payload.nome,
        "versao_a_id": str(payload.versao_a_id),
        "versao_b_id": str(payload.versao_b_id) if payload.versao_b_id else None,
        "ajustes_whatif": payload.ajustes_whatif.model_dump(mode="json") if payload.ajustes_whatif else None,
        "resultado": payload.resultado.model_dump(mode="json"),
    }
    snapshot = repository.criar_snapshot(contrato_id, current_user.user_id, dados)
    return SnapshotResponse(**snapshot)


@router.get("/snapshots", response_model=list[SnapshotResponse])
def listar_snapshots(contrato_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    repository.get_contrato_or_404(contrato_id, current_user.organization_id)
    return [SnapshotResponse(**s) for s in repository.listar_snapshots(contrato_id)]


@router.delete("/snapshots/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_snapshot(contrato_id: UUID, snapshot_id: UUID, current_user: CurrentUser = Depends(require_owner_or_executor)):
    repository.get_contrato_or_404(contrato_id, current_user.organization_id)
    repository.excluir_snapshot(snapshot_id, contrato_id)
