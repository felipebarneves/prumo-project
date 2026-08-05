"""Tela 3 — Cronograma Físico-Financeiro. docs/api-spec-viabilidade.md seção 4."""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from .. import mapping, repository
from ..schemas.common import ErrorCode
from ..schemas.cronograma import (
    CelulaCronograma,
    CronogramaCelulasUpdateRequest,
    CronogramaCelulasUpdateResponse,
    CronogramaResponse,
    LinhaCronogramaResponse,
)
from ..services.cronograma_engine import distribuir_volumetria, janela_da_linha, soma_diverge_do_total
from .deps import CurrentUser, get_current_user, require_owner_or_executor

router = APIRouter(prefix="/api/v1/versoes/{versao_id}/cronograma", tags=["cronograma"])


def _erro(status_code: int, error_code: ErrorCode | str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error_code": str(error_code), "message": message})


def _montar_cronograma_response(versao_id: UUID, contrato: dict, linhas: list[dict], distribuir) -> CronogramaResponse:
    meses = list(range(1, contrato["duracao_meses"] + 1))
    linhas_resp: list[LinhaCronogramaResponse] = []

    for linha in linhas:
        mes_inicio = linha.get("mes_inicio") or 1
        prazo = linha.get("prazo_meses") or contrato["duracao_meses"]
        total_linha = Decimal(str(linha["volumetria"]))
        distribuicao_manual, unitario_campo = distribuir(linha)
        distribuicao = distribuir_volumetria(mes_inicio, prazo, total_linha, distribuicao_manual)
        janela = set(janela_da_linha(mes_inicio, prazo))
        unitario = Decimal(str(linha[unitario_campo]))

        celulas = []
        for mes in meses:
            dentro = mes in janela
            volumetria = distribuicao.get(mes) if dentro else None
            celulas.append(
                CelulaCronograma(
                    mes=mes,
                    volumetria=volumetria,
                    valor_calculado=(volumetria * unitario) if volumetria is not None else None,
                    is_override=mes in distribuicao_manual,
                    dentro_da_janela=dentro,
                )
            )

        soma = sum(distribuicao.values(), Decimal(0))
        linhas_resp.append(
            LinhaCronogramaResponse(
                linha_id=linha["id"],
                descricao=linha["descricao"],
                total_linha=total_linha,
                soma_distribuicao=soma,
                divergente=soma_diverge_do_total(distribuicao, total_linha),
                celulas=celulas,
            )
        )

    return CronogramaResponse(versao_id=versao_id, meses=meses, linhas=linhas_resp)


@router.get("/receita", response_model=CronogramaResponse)
def cronograma_receita(versao_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    versao = repository.get_versao_or_404(versao_id, current_user.organization_id)
    contrato = repository.get_contrato_or_404(UUID(versao["contrato_id"]), current_user.organization_id)
    linhas = repository.listar_linhas_receita(versao_id)

    def distribuir(linha: dict) -> tuple[dict[int, Decimal], str]:
        manual = repository.listar_distribuicao_receita(UUID(linha["id"]))
        return {mes: Decimal(str(v)) for mes, v in manual.items()}, "valor_unitario"

    return _montar_cronograma_response(versao_id, contrato, linhas, distribuir)


@router.put("/receita/{linha_id}/celulas", response_model=CronogramaCelulasUpdateResponse)
def atualizar_celulas_receita(
    versao_id: UUID,
    linha_id: UUID,
    payload: CronogramaCelulasUpdateRequest,
    current_user: CurrentUser = Depends(require_owner_or_executor),
):
    versao = repository.get_versao_or_404(versao_id, current_user.organization_id)
    contrato = repository.get_contrato_or_404(UUID(versao["contrato_id"]), current_user.organization_id)
    linha = repository.get_linha_receita_or_404(linha_id, versao_id)

    mes_inicio = linha.get("mes_inicio") or 1
    prazo = linha.get("prazo_meses") or contrato["duracao_meses"]
    janela = set(janela_da_linha(mes_inicio, prazo))

    for celula in payload.celulas:
        if celula.mes not in janela:
            raise _erro(
                status.HTTP_400_BAD_REQUEST,
                ErrorCode.JANELA_LINHA_EXCEDIDA,
                f"O mês {celula.mes} está fora da janela desta linha ({mes_inicio}-{mes_inicio + prazo - 1}).",
            )
        repository.upsert_celula_distribuicao_receita(linha_id, celula.mes, celula.volumetria)

    distribuicao_atualizada = repository.listar_distribuicao_receita(linha_id)
    distribuicao = distribuir_volumetria(
        mes_inicio, prazo, Decimal(str(linha["volumetria"])), {m: Decimal(str(v)) for m, v in distribuicao_atualizada.items()}
    )
    total_linha = Decimal(str(linha["volumetria"]))
    soma = sum(distribuicao.values(), Decimal(0))
    warning = ErrorCode.DISTRIBUICAO_SOMA_DIVERGENTE if soma_diverge_do_total(distribuicao, total_linha) else None

    return CronogramaCelulasUpdateResponse(linha_id=linha_id, soma_distribuicao=soma, total_linha=total_linha, warning=warning)


@router.post("/receita/{linha_id}/reset", status_code=status.HTTP_200_OK)
def resetar_cronograma_linha_receita(
    versao_id: UUID, linha_id: UUID, current_user: CurrentUser = Depends(require_owner_or_executor)
):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    repository.get_linha_receita_or_404(linha_id, versao_id)
    repository.resetar_distribuicao_receita(linha_id)
    return {"linha_id": str(linha_id), "status": "distribuicao_resetada"}


@router.post("/receita/reset-lote", status_code=status.HTTP_200_OK)
def resetar_cronograma_lote_receita(versao_id: UUID, current_user: CurrentUser = Depends(require_owner_or_executor)):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    for linha in repository.listar_linhas_receita(versao_id):
        repository.resetar_distribuicao_receita(UUID(linha["id"]))
    return {"status": "distribuicao_resetada_em_lote"}


@router.get("/custo", response_model=CronogramaResponse)
def cronograma_custo(versao_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    versao = repository.get_versao_or_404(versao_id, current_user.organization_id)
    contrato = repository.get_contrato_or_404(UUID(versao["contrato_id"]), current_user.organization_id)
    linhas = repository.listar_linhas_custo(versao_id)

    def distribuir(linha: dict) -> tuple[dict[int, Decimal], str]:
        manual = repository.listar_distribuicao_custo(UUID(linha["id"]))
        return {mes: Decimal(str(v)) for mes, v in manual.items()}, "custo_unitario"

    return _montar_cronograma_response(versao_id, contrato, linhas, distribuir)


@router.put("/custo/{linha_id}/celulas", response_model=CronogramaCelulasUpdateResponse)
def atualizar_celulas_custo(
    versao_id: UUID,
    linha_id: UUID,
    payload: CronogramaCelulasUpdateRequest,
    current_user: CurrentUser = Depends(require_owner_or_executor),
):
    versao = repository.get_versao_or_404(versao_id, current_user.organization_id)
    contrato = repository.get_contrato_or_404(UUID(versao["contrato_id"]), current_user.organization_id)
    linha = repository.get_linha_custo_or_404(linha_id, versao_id)

    mes_inicio = linha.get("mes_inicio") or 1
    prazo = linha.get("prazo_meses") or contrato["duracao_meses"]
    janela = set(janela_da_linha(mes_inicio, prazo))

    for celula in payload.celulas:
        if celula.mes not in janela:
            raise _erro(
                status.HTTP_400_BAD_REQUEST,
                ErrorCode.JANELA_LINHA_EXCEDIDA,
                f"O mês {celula.mes} está fora da janela desta linha ({mes_inicio}-{mes_inicio + prazo - 1}).",
            )
        repository.upsert_celula_distribuicao_custo(linha_id, celula.mes, celula.volumetria)

    distribuicao_atualizada = repository.listar_distribuicao_custo(linha_id)
    distribuicao = distribuir_volumetria(
        mes_inicio, prazo, Decimal(str(linha["volumetria"])), {m: Decimal(str(v)) for m, v in distribuicao_atualizada.items()}
    )
    total_linha = Decimal(str(linha["volumetria"]))
    soma = sum(distribuicao.values(), Decimal(0))
    warning = ErrorCode.DISTRIBUICAO_SOMA_DIVERGENTE if soma_diverge_do_total(distribuicao, total_linha) else None

    return CronogramaCelulasUpdateResponse(linha_id=linha_id, soma_distribuicao=soma, total_linha=total_linha, warning=warning)


@router.post("/custo/{linha_id}/reset", status_code=status.HTTP_200_OK)
def resetar_cronograma_linha_custo(
    versao_id: UUID, linha_id: UUID, current_user: CurrentUser = Depends(require_owner_or_executor)
):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    repository.get_linha_custo_or_404(linha_id, versao_id)
    repository.resetar_distribuicao_custo(linha_id)
    return {"linha_id": str(linha_id), "status": "distribuicao_resetada"}


@router.post("/custo/reset-lote", status_code=status.HTTP_200_OK)
def resetar_cronograma_lote_custo(versao_id: UUID, current_user: CurrentUser = Depends(require_owner_or_executor)):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    for linha in repository.listar_linhas_custo(versao_id):
        repository.resetar_distribuicao_custo(UUID(linha["id"]))
    return {"status": "distribuicao_resetada_em_lote"}
