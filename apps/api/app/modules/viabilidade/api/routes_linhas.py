"""Tela 2 — Linhas de Receita e Custo. docs/api-spec-viabilidade.md seção 3."""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from .. import repository
from ..schemas.common import ErrorCode
from ..schemas.linhas import (
    LinhaCustoCreateRequest,
    LinhaCustoResponse,
    LinhaCustoUpdateRequest,
    LinhaReceitaCreateRequest,
    LinhaReceitaResponse,
    LinhaReceitaUpdateRequest,
)
from .deps import CurrentUser, get_current_user, require_owner_or_executor

router = APIRouter(prefix="/api/v1/versoes/{versao_id}", tags=["linhas"])


def _erro(status_code: int, error_code: ErrorCode | str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error_code": str(error_code), "message": message})


def _validar_janela(mes_inicio: int | None, prazo_meses: int | None, duracao_projeto: int) -> None:
    """PRD Tela 2, seção 4/5 — Mês de Início + Prazo não pode exceder a janela do projeto."""
    inicio = mes_inicio or 1
    prazo = prazo_meses or duracao_projeto
    if inicio + prazo - 1 > duracao_projeto:
        raise _erro(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.JANELA_LINHA_EXCEDIDA,
            "O Mês de Início somado ao Prazo da linha excede a duração do projeto.",
        )


# --------------------------------------------------------------------------- Receita

@router.post("/linhas-receita", response_model=LinhaReceitaResponse, status_code=status.HTTP_201_CREATED)
def criar_linha_receita(
    versao_id: UUID, payload: LinhaReceitaCreateRequest, current_user: CurrentUser = Depends(require_owner_or_executor)
):
    versao = repository.get_versao_or_404(versao_id, current_user.organization_id)
    contrato = repository.get_contrato_or_404(UUID(versao["contrato_id"]), current_user.organization_id)
    _validar_janela(payload.mes_inicio, payload.prazo_meses, contrato["duracao_meses"])

    linha = repository.criar_linha_receita(versao_id, payload.model_dump(mode="json"))
    return _linha_receita_para_response(linha)


@router.get("/linhas-receita", response_model=list[LinhaReceitaResponse])
def listar_linhas_receita(versao_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    return [_linha_receita_para_response(linha) for linha in repository.listar_linhas_receita(versao_id)]


@router.patch("/linhas-receita/{linha_id}", response_model=LinhaReceitaResponse)
def atualizar_linha_receita(
    versao_id: UUID,
    linha_id: UUID,
    payload: LinhaReceitaUpdateRequest,
    current_user: CurrentUser = Depends(require_owner_or_executor),
):
    versao = repository.get_versao_or_404(versao_id, current_user.organization_id)
    linha = repository.get_linha_receita_or_404(linha_id, versao_id)

    campos_restritos = {"volumetria", "prazo_meses", "valor_unitario"}
    # exclude_unset (não exclude_none): aliquota_especifica é opcional e nullable
    # — só omitir o que o cliente não enviou, senão nunca seria possível limpar a
    # alíquota específica de volta para null (herdar a alíquota geral) via edição.
    dados = payload.model_dump(exclude_unset=True, mode="json")

    if linha.get("origem_line_id") and campos_restritos & dados.keys():
        raise _erro(
            status.HTTP_409_CONFLICT,
            ErrorCode.LINHA_BLOQUEADA_POR_ORIGEM,
            "Esta linha foi importada da Precificação e está vinculada — total, prazo e valor unitário não podem ser editados enquanto o vínculo estiver ativo.",
        )

    campos_bloqueados_por_override = {"volumetria", "prazo_meses"}
    if repository.linha_receita_possui_override(linha_id) and campos_bloqueados_por_override & dados.keys():
        raise _erro(
            status.HTTP_409_CONFLICT,
            ErrorCode.LINHA_BLOQUEADA_POR_OVERRIDE,
            "Esta linha possui distribuição manual no Cronograma — execute o Reset de Distribuição antes de editar volumetria ou prazo.",
        )

    if "mes_inicio" in dados or "prazo_meses" in dados:
        contrato = repository.get_contrato_or_404(UUID(versao["contrato_id"]), current_user.organization_id)
        _validar_janela(
            dados.get("mes_inicio", linha.get("mes_inicio")),
            dados.get("prazo_meses", linha.get("prazo_meses")),
            contrato["duracao_meses"],
        )

    atualizada = repository.atualizar_linha_receita(linha_id, dados)
    return _linha_receita_para_response(atualizada)


@router.delete("/linhas-receita/{linha_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_linha_receita(versao_id: UUID, linha_id: UUID, current_user: CurrentUser = Depends(require_owner_or_executor)):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    repository.get_linha_receita_or_404(linha_id, versao_id)
    repository.excluir_linha_receita(linha_id)


def _linha_receita_para_response(linha: dict) -> LinhaReceitaResponse:
    return LinhaReceitaResponse(
        **linha,
        valor_total_calculado=Decimal(str(linha["volumetria"])) * Decimal(str(linha["valor_unitario"])),
        bloqueado_por_origem=linha.get("origem_line_id") is not None,
        bloqueado_por_override=repository.linha_receita_possui_override(UUID(linha["id"])),
    )


# --------------------------------------------------------------------------- Custo

@router.post("/linhas-custo", response_model=LinhaCustoResponse, status_code=status.HTTP_201_CREATED)
def criar_linha_custo(
    versao_id: UUID, payload: LinhaCustoCreateRequest, current_user: CurrentUser = Depends(require_owner_or_executor)
):
    versao = repository.get_versao_or_404(versao_id, current_user.organization_id)
    contrato = repository.get_contrato_or_404(UUID(versao["contrato_id"]), current_user.organization_id)
    _validar_janela(payload.mes_inicio, payload.prazo_meses, contrato["duracao_meses"])

    linha = repository.criar_linha_custo(versao_id, payload.model_dump(mode="json"))
    return _linha_custo_para_response(linha)


@router.get("/linhas-custo", response_model=list[LinhaCustoResponse])
def listar_linhas_custo(versao_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    return [_linha_custo_para_response(linha) for linha in repository.listar_linhas_custo(versao_id)]


@router.patch("/linhas-custo/{linha_id}", response_model=LinhaCustoResponse)
def atualizar_linha_custo(
    versao_id: UUID,
    linha_id: UUID,
    payload: LinhaCustoUpdateRequest,
    current_user: CurrentUser = Depends(require_owner_or_executor),
):
    versao = repository.get_versao_or_404(versao_id, current_user.organization_id)
    linha = repository.get_linha_custo_or_404(linha_id, versao_id)

    campos_restritos = {"volumetria", "prazo_meses", "custo_unitario"}
    # exclude_unset (não exclude_none): mesmo raciocínio de atualizar_linha_receita
    # acima — só omitir campos que o cliente não enviou no payload.
    dados = payload.model_dump(exclude_unset=True, mode="json")

    if linha.get("origem_line_id") and campos_restritos & dados.keys():
        raise _erro(
            status.HTTP_409_CONFLICT,
            ErrorCode.LINHA_BLOQUEADA_POR_ORIGEM,
            "Esta linha foi importada da Precificação e está vinculada — total, prazo e custo unitário não podem ser editados enquanto o vínculo estiver ativo.",
        )

    campos_bloqueados_por_override = {"volumetria", "prazo_meses"}
    if repository.linha_custo_possui_override(linha_id) and campos_bloqueados_por_override & dados.keys():
        raise _erro(
            status.HTTP_409_CONFLICT,
            ErrorCode.LINHA_BLOQUEADA_POR_OVERRIDE,
            "Esta linha possui distribuição manual no Cronograma — execute o Reset de Distribuição antes de editar volumetria ou prazo.",
        )

    if "mes_inicio" in dados or "prazo_meses" in dados:
        contrato = repository.get_contrato_or_404(UUID(versao["contrato_id"]), current_user.organization_id)
        _validar_janela(
            dados.get("mes_inicio", linha.get("mes_inicio")),
            dados.get("prazo_meses", linha.get("prazo_meses")),
            contrato["duracao_meses"],
        )

    atualizada = repository.atualizar_linha_custo(linha_id, dados)
    return _linha_custo_para_response(atualizada)


@router.delete("/linhas-custo/{linha_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_linha_custo(versao_id: UUID, linha_id: UUID, current_user: CurrentUser = Depends(require_owner_or_executor)):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    repository.get_linha_custo_or_404(linha_id, versao_id)
    repository.excluir_linha_custo(linha_id)


def _linha_custo_para_response(linha: dict) -> LinhaCustoResponse:
    return LinhaCustoResponse(
        **linha,
        custo_total_calculado=Decimal(str(linha["volumetria"])) * Decimal(str(linha["custo_unitario"])),
        bloqueado_por_origem=linha.get("origem_line_id") is not None,
        bloqueado_por_override=repository.linha_custo_possui_override(UUID(linha["id"])),
    )
