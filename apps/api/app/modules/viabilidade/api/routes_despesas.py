"""Tela 2, seção 5b — Despesas Não Operacionais. docs/api-spec-viabilidade.md seção 3."""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, status

from .. import mapping, repository
from ..schemas.despesas import (
    CustoFinanceiroProjecaoResponse,
    DespesaNaoOperacionalCreateRequest,
    DespesaNaoOperacionalResponse,
    DespesaNaoOperacionalUpdateRequest,
)
from ..services.motor import calcular_projeto
from .deps import CurrentUser, get_current_user, require_owner_or_executor

router = APIRouter(prefix="/api/v1/versoes/{versao_id}/despesas-nao-operacionais", tags=["despesas"])


@router.post("", response_model=DespesaNaoOperacionalResponse, status_code=status.HTTP_201_CREATED)
def criar_despesa(
    versao_id: UUID, payload: DespesaNaoOperacionalCreateRequest, current_user: CurrentUser = Depends(require_owner_or_executor)
):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    despesa = repository.criar_despesa(versao_id, payload.model_dump(mode="json"))
    return DespesaNaoOperacionalResponse(**despesa)


@router.get("", response_model=list[DespesaNaoOperacionalResponse])
def listar_despesas(versao_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    return [DespesaNaoOperacionalResponse(**d) for d in repository.listar_despesas(versao_id)]


@router.patch("/{despesa_id}", response_model=DespesaNaoOperacionalResponse)
def atualizar_despesa(
    versao_id: UUID,
    despesa_id: UUID,
    payload: DespesaNaoOperacionalUpdateRequest,
    current_user: CurrentUser = Depends(require_owner_or_executor),
):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    # exclude_unset (não exclude_none): linha_receita_referencia_id é opcional e
    # nullable — só omitir o que o cliente não enviou, senão nunca seria possível
    # limpar a referência de volta para "Receita Bruta Total" (null) via edição.
    atualizada = repository.atualizar_despesa(despesa_id, versao_id, payload.model_dump(exclude_unset=True, mode="json"))
    return DespesaNaoOperacionalResponse(**atualizada)


@router.delete("/{despesa_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_despesa(versao_id: UUID, despesa_id: UUID, current_user: CurrentUser = Depends(require_owner_or_executor)):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    repository.excluir_despesa(despesa_id, versao_id)


@router.get("/custo-financeiro", response_model=CustoFinanceiroProjecaoResponse)
def projecao_custo_financeiro(versao_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    """Linha automática, não editável (PRD Tela 2, seção 5b) — projeção derivada da Taxa de Custo de Captação."""
    _, contrato, (receitas, custos, despesas, parametros, projeto) = mapping.carregar_calc_por_versao_id(
        versao_id, current_user.organization_id
    )
    resultado = calcular_projeto(receitas, custos, despesas, parametros, projeto)
    valores = [m.custo_financeiro for m in resultado.meses if m.mes <= contrato["duracao_meses"]]
    return CustoFinanceiroProjecaoResponse(valores_mensais=valores, total=sum(valores, Decimal(0)))
