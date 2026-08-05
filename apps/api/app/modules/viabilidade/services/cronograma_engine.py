"""Tela 3 — Distribuição temporal da Volumetria. PRD seção 3.4.

Regra: distribuição linear por padrão (total ÷ meses da janela); overrides manuais
substituem células específicas. A soma pode divergir do total (aviso não-bloqueante,
seção 0.2 do contrato de API) — este motor não corrige/realoca automaticamente os
demais meses quando um override é aplicado.
"""
from __future__ import annotations

from decimal import Decimal

from .decimal_utils import divisao_segura


def janela_da_linha(mes_inicio: int, prazo_meses: int) -> range:
    return range(mes_inicio, mes_inicio + prazo_meses)


def distribuir_volumetria(
    mes_inicio: int,
    prazo_meses: int,
    volumetria_total: Decimal,
    distribuicao_manual: dict[int, Decimal] | None = None,
) -> dict[int, Decimal]:
    """Retorna {mes: volumetria} apenas para os meses dentro da janela da linha.

    Meses fora da janela simplesmente não aparecem no dicionário — o chamador
    deve tratar a ausência como "fora da janela" (célula travada, `—`), distinto
    de uma volumetria explícita igual a zero (PRD Tela 3, seção 4).
    """
    distribuicao_manual = distribuicao_manual or {}
    janela = janela_da_linha(mes_inicio, prazo_meses)

    linear_por_mes = divisao_segura(volumetria_total, Decimal(prazo_meses)) or Decimal(0)

    resultado: dict[int, Decimal] = {}
    for mes in janela:
        if mes in distribuicao_manual:
            resultado[mes] = distribuicao_manual[mes]
        else:
            resultado[mes] = linear_por_mes
    return resultado


def soma_diverge_do_total(distribuicao: dict[int, Decimal], total_linha: Decimal) -> bool:
    soma = sum(distribuicao.values(), Decimal(0))
    return soma != total_linha


def valor_mensal_calculado(distribuicao: dict[int, Decimal], valor_unitario: Decimal) -> dict[int, Decimal]:
    """Valor (ou Custo) mensal = Volumetria distribuída no mês × Valor/Custo Unitário (fixo). PRD 3.3."""
    return {mes: volumetria * valor_unitario for mes, volumetria in distribuicao.items()}
