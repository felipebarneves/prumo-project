"""Tela 7 — Simulação What-If. PRD seção 3.8.

Reutiliza o motor de cálculo completo — não existe um motor "rápido" separado. Os três
diais percentuais são aplicados diretamente nos inputs de origem (Volumetria de Receita,
Valor Unitário, Custo Unitário) antes de rodar a mesma cadeia Cronograma → DRE → Fluxo
de Caixa. O ajuste de Volumetria de Receita nunca afeta a Volumetria de Custo — tabelas
independentes, sem correlação assumida pelo motor.
"""
from __future__ import annotations

from dataclasses import replace
from decimal import Decimal

from .metricas import MetricasResumo, calcular_metricas_resumo
from .models import DespesaNaoOperacionalCalc, LinhaCustoCalc, LinhaReceitaCalc, ParametrosCalc, ProjetoCalc
from .motor import calcular_projeto


def aplicar_ajustes_receita(
    linhas: list[LinhaReceitaCalc], ajuste_valor_pct: Decimal, ajuste_volumetria_pct: Decimal
) -> list[LinhaReceitaCalc]:
    fator_valor = Decimal(1) + ajuste_valor_pct
    fator_volumetria = Decimal(1) + ajuste_volumetria_pct
    return [
        replace(
            linha,
            valor_unitario=linha.valor_unitario * fator_valor,
            volumetria_total=linha.volumetria_total * fator_volumetria,
        )
        for linha in linhas
    ]


def aplicar_ajustes_custo(linhas: list[LinhaCustoCalc], ajuste_custo_pct: Decimal) -> list[LinhaCustoCalc]:
    fator = Decimal(1) + ajuste_custo_pct
    return [replace(linha, custo_unitario=linha.custo_unitario * fator) for linha in linhas]


def simular_whatif(
    receitas_base: list[LinhaReceitaCalc],
    custos_base: list[LinhaCustoCalc],
    despesas: list[DespesaNaoOperacionalCalc],
    parametros: ParametrosCalc,
    projeto: ProjetoCalc,
    ajuste_receita_pct: Decimal,
    ajuste_custo_pct: Decimal,
    ajuste_volumetria_receita_pct: Decimal,
) -> tuple[MetricasResumo, MetricasResumo]:
    """Retorna (métricas da versão-base, métricas do resultado simulado)."""
    resultado_base = calcular_projeto(receitas_base, custos_base, despesas, parametros, projeto)
    metricas_base = calcular_metricas_resumo(resultado_base)

    receitas_ajustadas = aplicar_ajustes_receita(receitas_base, ajuste_receita_pct, ajuste_volumetria_receita_pct)
    custos_ajustados = aplicar_ajustes_custo(custos_base, ajuste_custo_pct)
    resultado_simulado = calcular_projeto(receitas_ajustadas, custos_ajustados, despesas, parametros, projeto)
    metricas_simuladas = calcular_metricas_resumo(resultado_simulado)

    return metricas_base, metricas_simuladas
