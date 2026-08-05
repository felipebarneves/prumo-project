"""Tela 6 — Dashboard do Projeto / Tela 8 — Home da Organização. docs/api-spec-viabilidade.md seções 7 e 9."""
from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class DashboardKPIs(BaseModel):
    receita_bruta_total: Decimal
    ebitda_total: Decimal
    margem_ebitda: Decimal
    fluxo_liquido_total: Decimal
    vpl: Decimal | None
    tir: Decimal | None
    tirm: Decimal | None
    payback_mes: int | None
    breakeven_mes: int | None
    capital_de_giro: Decimal
    custo_financeiro_total: Decimal


class GraficoAnualSerie(BaseModel):
    ano: int
    receita_liquida: Decimal
    custos: Decimal
    ebitda: Decimal


class GraficoFluxoCaixaAnualSerie(BaseModel):
    ano: int
    fluxo_anual: Decimal
    caixa_acumulado: Decimal


class DashboardProjetoResponse(BaseModel):
    versao_id: UUID
    kpis: DashboardKPIs
    grafico_dre_por_ano: list[GraficoAnualSerie]
    grafico_fluxo_caixa_por_ano: list[GraficoFluxoCaixaAnualSerie]


class DashboardDrillDownMensalResponse(BaseModel):
    ano: int
    meses: list[int]
    receita_liquida_mensal: list[Decimal]
    custos_mensal: list[Decimal]
    ebitda_mensal: list[Decimal]
    fluxo_mensal: list[Decimal]
    caixa_acumulado_mensal: list[Decimal]


class HomeOrganizacaoKPIs(BaseModel):
    receita_bruta_total: Decimal
    ebitda_total: Decimal
    margem_ebitda: Decimal
    contratos_ativos_atual: int
    contratos_ativos_limite: int


class HomeOrganizacaoResponse(BaseModel):
    kpis: HomeOrganizacaoKPIs
