"""KPIs derivados do motor de cálculo — VPL, TIR, TIRM, Payback, Breakeven, Capital de Giro.

PRD seção 3.6 (Fluxo de Caixa) e 3.7 (Dashboard). Regra crítica: Capital de Giro e Payback
usam o Fluxo Acumulado BRUTO; VPL/TIR/TIRM usam o Saldo de Caixa Final LÍQUIDO. São duas
séries distintas e não intercambiáveis — nunca reutilizar uma no lugar da outra.
"""
from __future__ import annotations

from decimal import Decimal

from .models import ResultadoProjeto

_MAX_ITERACOES_IRR = 200
_TOLERANCIA_IRR = Decimal("0.0000001")
_LIMITE_INFERIOR_TAXA = Decimal("-0.9999")
_LIMITE_SUPERIOR_TAXA = Decimal("10")


def capital_de_giro(resultado: ResultadoProjeto) -> Decimal:
    """Maior valor negativo do Fluxo Acumulado bruto — número único (PRD 3.6)."""
    fluxos = resultado.serie("fluxo_acumulado")
    return min([Decimal(0), *fluxos])


def payback_mes(resultado: ResultadoProjeto) -> int | None:
    """Mês em que o Fluxo Acumulado bruto cruza de negativo para positivo. None se não houver cruzamento."""
    fluxos = resultado.serie("fluxo_acumulado")
    anterior = Decimal(0)
    for mensal in resultado.meses:
        if anterior < 0 and mensal.fluxo_acumulado >= 0:
            return mensal.mes
        anterior = mensal.fluxo_acumulado
    return None


def breakeven_mes(resultado: ResultadoProjeto) -> int | None:
    """Primeiro mês em que o Fluxo Líquido Geral mensal (isolado, não acumulado) é positivo."""
    for mensal in resultado.meses:
        if mensal.fluxo_liquido_geral > 0:
            return mensal.mes
    return None


def _npv(fluxos: list[Decimal], taxa: Decimal) -> Decimal:
    base = Decimal(1) + taxa
    return sum((fluxo / (base**t) for t, fluxo in enumerate(fluxos, start=1)), Decimal(0))


def _ha_troca_de_sinal(fluxos: list[Decimal]) -> bool:
    sinais = [1 if f > 0 else (-1 if f < 0 else 0) for f in fluxos if f != 0]
    return any(a != b for a, b in zip(sinais, sinais[1:]))


def vpl(resultado: ResultadoProjeto, tma: Decimal | None) -> Decimal | None:
    """PRD 3.3 — None (TMA vazia) = "não calcular", exibe `—`. Descontado sobre Saldo de Caixa Final."""
    if tma is None:
        return None
    fluxos = resultado.serie("saldo_caixa_final")
    return _npv(fluxos, tma)


def tir(resultado: ResultadoProjeto) -> Decimal | None:
    """TIR clássica — sempre tentada, independe de taxa. Sem troca de sinal → None (PRD 3.3)."""
    fluxos = resultado.serie("saldo_caixa_final")
    if not _ha_troca_de_sinal(fluxos):
        return None
    return _resolver_irr(fluxos)


def _resolver_irr(fluxos: list[Decimal]) -> Decimal | None:
    baixo, alto = _LIMITE_INFERIOR_TAXA, _LIMITE_SUPERIOR_TAXA
    npv_baixo = _npv(fluxos, baixo)
    npv_alto = _npv(fluxos, alto)
    if npv_baixo == 0:
        return baixo
    if npv_alto == 0:
        return alto
    if (npv_baixo > 0) == (npv_alto > 0):
        # Mesmo sinal nos extremos do intervalo de busca — sem raiz localizável no range suportado.
        return None

    for _ in range(_MAX_ITERACOES_IRR):
        meio = (baixo + alto) / 2
        npv_meio = _npv(fluxos, meio)
        if abs(npv_meio) < _TOLERANCIA_IRR:
            return meio
        if (npv_meio > 0) == (npv_baixo > 0):
            baixo, npv_baixo = meio, npv_meio
        else:
            alto, npv_alto = meio, npv_meio
    return (baixo + alto) / 2


def tirm(resultado: ResultadoProjeto, tma: Decimal | None, taxa_reinvestimento: Decimal | None) -> Decimal | None:
    """TIR Modificada (MIRR). None se TMA ou Taxa de Reinvestimento não preenchidas (PRD 3.3)."""
    if tma is None or taxa_reinvestimento is None:
        return None

    fluxos = resultado.serie("saldo_caixa_final")
    n = len(fluxos)
    if n == 0:
        return None

    fv_positivos = sum(
        (f * (Decimal(1) + taxa_reinvestimento) ** (n - t) for t, f in enumerate(fluxos, start=1) if f > 0),
        Decimal(0),
    )
    pv_negativos = sum(
        (f / (Decimal(1) + tma) ** t for t, f in enumerate(fluxos, start=1) if f < 0),
        Decimal(0),
    )

    if pv_negativos == 0 or fv_positivos <= 0:
        return None

    base = fv_positivos / (-pv_negativos)
    if base <= 0:
        return None
    return base ** (Decimal(1) / Decimal(n)) - Decimal(1)
