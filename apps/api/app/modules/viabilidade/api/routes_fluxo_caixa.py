"""Tela 5 — Fluxo de Caixa. 100% leitura. docs/api-spec-viabilidade.md seção 6."""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends

from .. import mapping
from ..schemas.fluxo_caixa import FluxoCaixaLinha, FluxoCaixaResponse
from ..services.kpi_engine import capital_de_giro
from ..services.motor import calcular_projeto
from .deps import CurrentUser, get_current_user

router = APIRouter(prefix="/api/v1/versoes", tags=["fluxo-caixa"])

_ITENS = [
    "entrada_caixa", "deducoes", "saida_caixa", "fluxo_liquido_operacional",
    "despesas_nao_operacionais", "irpj", "fluxo_liquido_geral",
    "fluxo_acumulado", "custo_financeiro", "saldo_caixa_final",
]

_MAPA_ATRIBUTO = {
    "entrada_caixa": "entrada_caixa",
    "deducoes": "deducoes",
    "saida_caixa": "saida_caixa",
    "fluxo_liquido_operacional": "fluxo_liquido_operacional",
    "despesas_nao_operacionais": "despesas_nao_operacionais_exceto_cf",
    "irpj": "irpj",
    "fluxo_liquido_geral": "fluxo_liquido_geral",
    "fluxo_acumulado": "fluxo_acumulado",
    "custo_financeiro": "custo_financeiro",
    "saldo_caixa_final": "saldo_caixa_final",
}

# Fluxo Acumulado e Saldo de Caixa Final já são saldos correntes (running balance) —
# o total do projeto é o valor do último período, não a soma dos períodos.
_ITENS_SALDO_CORRENTE = {"fluxo_acumulado", "saldo_caixa_final"}


@router.get("/{versao_id}/fluxo-caixa", response_model=FluxoCaixaResponse)
def fluxo_caixa(versao_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    _, _, (receitas, custos, despesas, parametros, projeto) = mapping.carregar_calc_por_versao_id(
        versao_id, current_user.organization_id
    )
    resultado = calcular_projeto(receitas, custos, despesas, parametros, projeto)
    meses = [m.mes for m in resultado.meses]

    linhas = []
    for item in _ITENS:
        serie = resultado.serie(_MAPA_ATRIBUTO[item])
        if item in _ITENS_SALDO_CORRENTE:
            total = serie[-1] if serie else Decimal(0)
        else:
            total = sum(serie, Decimal(0))
        linhas.append(FluxoCaixaLinha(item=item, valores_mensais=serie, total_projeto=total))

    return FluxoCaixaResponse(
        versao_id=versao_id,
        meses=meses,
        linhas=linhas,
        capital_de_giro=capital_de_giro(resultado),
    )
