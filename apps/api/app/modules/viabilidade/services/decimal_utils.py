"""Utilitários de precisão decimal — PRD 3.3 (regras de borda do motor de cálculo).

Cálculo interno em precisão decimal alta, sem arredondamento em etapas intermediárias.
Arredondamento comercial (ABNT, half-up) para 2 casas aplicado apenas na exibição e na
consolidação final por período/mês.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, getcontext

# Precisão interna alta o suficiente para projetos de múltiplas dezenas de anos
# sem perda de precisão acumulada em taxas mensais compostas.
getcontext().prec = 34

CENTAVO = Decimal("0.01")
PERCENTUAL_INTERNO = Decimal("1")  # taxas são armazenadas como fração decimal (ex: 0.10 = 10%)


def arredondar_2_casas(valor: Decimal) -> Decimal:
    """Arredondamento comercial (half-up) para exibição/consolidação final. Nunca usado em etapas intermediárias."""
    return valor.quantize(CENTAVO, rounding=ROUND_HALF_UP)


def zero_se_none(valor: Decimal | None) -> Decimal:
    return valor if valor is not None else Decimal(0)


def divisao_segura(numerador: Decimal, denominador: Decimal) -> Decimal | None:
    """PRD 3.3 — indicadores com denominador zero exibem `—` (None), nunca erro/infinito/NaN."""
    if denominador == 0:
        return None
    return numerador / denominador
