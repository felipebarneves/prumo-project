"""Tela 1 — Cadastro e Consulta de Projetos/Contratos. docs/api-spec-viabilidade.md seção 2."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from .. import repository
from ..schemas.common import ErrorCode
from ..schemas.contratos import (
    ArquivarContratoResponse,
    ContratoCreateRequest,
    ContratoListItem,
    ContratoListResponse,
    ContratoResponse,
    ContratoUpdateRequest,
    VincularModuloRequest,
    VincularModuloResponse,
)
from .deps import CurrentUser, get_current_user, require_owner, require_owner_or_executor

router = APIRouter(prefix="/api/v1/contratos", tags=["contratos"])


def _erro(status_code: int, error_code: ErrorCode | str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error_code": str(error_code), "message": message})


def _para_response(contrato: dict) -> ContratoResponse:
    vinculos = repository.listar_vinculos_modulo(UUID(contrato["id"]))
    return ContratoResponse(
        **{k: v for k, v in contrato.items() if k not in ("versao_inicial_id",)},
        modulos_vinculados=[v["modulo"] for v in vinculos],
        versao_inicial_id=contrato.get("versao_inicial_id") or contrato["id"],
    )


@router.post("", response_model=ContratoResponse, status_code=status.HTTP_201_CREATED)
def criar_contrato(payload: ContratoCreateRequest, current_user: CurrentUser = Depends(require_owner_or_executor)):
    capacidade = repository.get_plan_capacity(current_user.plan_tier)
    if repository.contar_contratos_ativos(current_user.organization_id) >= capacidade["max_active_contracts"]:
        raise _erro(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.LIMITE_PLANO_EXCEDIDO,
            "Você atingiu o limite de Contratos Ativos do seu plano. Arquive um projeto existente ou faça upgrade.",
        )

    dados_contrato = payload.model_dump(exclude={"nome_versao"}, mode="json")
    contrato = repository.criar_contrato(current_user.organization_id, current_user.user_id, dados_contrato)
    versao = repository.criar_versao(UUID(contrato["id"]), current_user.user_id, payload.nome_versao, None)
    contrato["versao_inicial_id"] = versao["id"]
    return _para_response(contrato)


@router.get("", response_model=ContratoListResponse)
def listar_contratos(
    status_ciclo_vida: str | None = None,
    modulo_vinculado: str | None = None,
    mostrar_arquivados: bool = False,
    busca: str | None = None,
    page: int = 1,
    page_size: int = 25,
    current_user: CurrentUser = Depends(get_current_user),
):
    filtros = {
        "status_ciclo_vida": status_ciclo_vida,
        "mostrar_arquivados": mostrar_arquivados,
        "busca": busca,
    }
    itens, total = repository.listar_contratos(current_user.organization_id, filtros, page, page_size)

    resultado = []
    for item in itens:
        vinculos = repository.listar_vinculos_modulo(UUID(item["id"]))
        modulos = [v["modulo"] for v in vinculos]
        if modulo_vinculado and modulo_vinculado not in modulos:
            continue
        resultado.append(
            ContratoListItem(
                id=item["id"],
                nome_projeto=item["nome_projeto"],
                cliente=item["cliente"],
                status_ciclo_vida=item["status_ciclo_vida"],
                modulos_vinculados=modulos,
                arquivado=item["arquivado_em"] is not None,
                created_at=item["created_at"],
            )
        )
    return ContratoListResponse(items=resultado, total=total, page=page, page_size=page_size)


@router.get("/{contrato_id}", response_model=ContratoResponse)
def obter_contrato(contrato_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    contrato = repository.get_contrato_or_404(contrato_id, current_user.organization_id)
    return _para_response(contrato)


@router.patch("/{contrato_id}", response_model=ContratoResponse)
def atualizar_contrato(
    contrato_id: UUID, payload: ContratoUpdateRequest, current_user: CurrentUser = Depends(require_owner_or_executor)
):
    dados = payload.model_dump(exclude_none=True, mode="json")
    contrato = repository.atualizar_contrato(contrato_id, current_user.organization_id, dados)
    return _para_response(contrato)


@router.delete("/{contrato_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_contrato(contrato_id: UUID, current_user: CurrentUser = Depends(require_owner)):
    repository.get_contrato_or_404(contrato_id, current_user.organization_id)
    from app.core.supabase import supabase  # import local para evitar dependência circular no topo do módulo

    supabase.table("contratos").delete().eq("id", str(contrato_id)).execute()


@router.post("/{contrato_id}/arquivar", response_model=ArquivarContratoResponse)
def arquivar_contrato(contrato_id: UUID, current_user: CurrentUser = Depends(require_owner_or_executor)):
    contrato = repository.get_contrato_or_404(contrato_id, current_user.organization_id)
    if contrato["arquivado_em"] is not None:
        raise _erro(status.HTTP_409_CONFLICT, "JA_ARQUIVADO", "Este contrato já está arquivado.")

    vinculos = repository.listar_vinculos_modulo(contrato_id)
    modulos_afetados = ["viabilidade", *[v["modulo"] for v in vinculos]]

    atualizado = repository.atualizar_contrato(contrato_id, current_user.organization_id, {"arquivado_em": "now()"})
    return ArquivarContratoResponse(
        contrato_id=contrato_id, modulos_afetados=modulos_afetados, arquivado_em=atualizado["arquivado_em"]
    )


@router.post("/{contrato_id}/desarquivar", response_model=ContratoResponse)
def desarquivar_contrato(contrato_id: UUID, current_user: CurrentUser = Depends(require_owner_or_executor)):
    capacidade = repository.get_plan_capacity(current_user.plan_tier)
    if repository.contar_contratos_ativos(current_user.organization_id) >= capacidade["max_active_contracts"]:
        raise _erro(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.LIMITE_PLANO_EXCEDIDO,
            "Não há vaga disponível no seu plano atual para desarquivar este contrato.",
        )
    contrato = repository.atualizar_contrato(contrato_id, current_user.organization_id, {"arquivado_em": None})
    return _para_response(contrato)


@router.post("/{contrato_id}/vinculos", response_model=VincularModuloResponse, status_code=status.HTTP_201_CREATED)
def vincular_modulo(
    contrato_id: UUID, payload: VincularModuloRequest, current_user: CurrentUser = Depends(require_owner_or_executor)
):
    repository.get_contrato_or_404(contrato_id, current_user.organization_id)
    existentes = repository.listar_vinculos_modulo(contrato_id)
    if any(v["modulo"] == payload.modulo for v in existentes):
        raise _erro(status.HTTP_409_CONFLICT, "VINCULO_JA_EXISTE", "Este módulo já está vinculado a este contrato.")

    vinculo = repository.criar_vinculo_modulo(
        contrato_id, current_user.user_id, payload.modulo, payload.contrato_origem_id
    )
    # Importação inicial por cópia (PRD 3.2) — depende da integração com o módulo de
    # origem (Precificação/Gestão), ainda não implementada neste repositório; os
    # contadores abaixo refletem "0 importadas" até essa integração existir.
    return VincularModuloResponse(**vinculo, linhas_importadas_receita=0, linhas_importadas_custo=0)


@router.delete("/{contrato_id}/vinculos/{modulo}", status_code=status.HTTP_204_NO_CONTENT)
def desvincular_modulo(contrato_id: UUID, modulo: str, current_user: CurrentUser = Depends(require_owner_or_executor)):
    repository.get_contrato_or_404(contrato_id, current_user.organization_id)
    repository.desvincular_modulo(contrato_id, modulo)
