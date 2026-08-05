"""Tela 4 — DRE Detalhado + Resumo DRE. docs/api-spec-viabilidade.md seção 5."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from .common import GranularidadeResumo

NOTA_IRPJ = (
    "O cálculo de IRPJ apresentado utiliza uma fórmula simplificada "
    "(15% + adicional de 10% sobre o EBIT mensal excedente a R$20.000), "
    "aplicada de forma equivalente para os regimes de Lucro Presumido e "
    "Lucro Real neste MVP. Não substitui apuração fiscal formal."
)

DREItem = Literal[
    "receita_operacional_bruta", "deducoes", "receita_operacional_liquida",
    "custos_operacionais", "ebitda", "despesas_nao_operacionais", "ebit",
    "ebit_acumulado", "irpj", "lucro_liquido",
    "margem_ebitda", "margem_ebit", "margem_liquida",
]


class DREItemMensal(BaseModel):
    mes: int
    valor: Decimal


class DRELinha(BaseModel):
    item: DREItem
    total_projeto: Decimal
    valores_mensais: list[DREItemMensal]


class DREDetalhadoResponse(BaseModel):
    versao_id: UUID
    meses: list[int]
    linhas: list[DRELinha]
    nota_irpj: str = NOTA_IRPJ


class DREPeriodoConsolidado(BaseModel):
    periodo_label: str
    valor: Decimal


class DRELinhaResumo(BaseModel):
    item: str
    total_projeto: Decimal
    periodos: list[DREPeriodoConsolidado]


class ResumoDREQuery(BaseModel):
    granularidade: GranularidadeResumo


class ResumoDREResponse(BaseModel):
    versao_id: UUID
    granularidade: GranularidadeResumo
    inicio_projeto: date
    fim_contrato: date
    prazo_meses: int
    linhas: list[DRELinhaResumo]
    nota_irpj: str = NOTA_IRPJ
