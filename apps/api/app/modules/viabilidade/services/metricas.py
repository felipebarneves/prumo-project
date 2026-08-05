"""Métricas consolidadas de projeto — reutilizadas por Comparar Versões e What-If (PRD Tela 7)."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .decimal_utils import divisao_segura
from .kpi_engine import payback_mes
from .models import ResultadoProjeto


@dataclass(frozen=True)
class MetricasResumo:
    receita_bruta: Decimal
    impostos: Decimal
    receita_liquida: Decimal
    custos_totais: Decimal
    ebitda: Decimal
    margem_ebitda: Decimal | None
    payback_mes: int | None


def calcular_metricas_resumo(resultado: ResultadoProjeto) -> MetricasResumo:
    receita_bruta = resultado.total("receita_bruta")
    impostos = resultado.total("deducoes")
    receita_liquida = resultado.total("receita_liquida")
    custos_totais = resultado.total("custos_operacionais")
    ebitda = resultado.total("ebitda")
    margem_ebitda = divisao_segura(ebitda, receita_bruta)

    return MetricasResumo(
        receita_bruta=receita_bruta,
        impostos=impostos,
        receita_liquida=receita_liquida,
        custos_totais=custos_totais,
        ebitda=ebitda,
        margem_ebitda=margem_ebitda,
        payback_mes=payback_mes(resultado),
    )
