"""Conversão de mês relativo do projeto (1 = mês de início do contrato) para
data-calendário real — usada por qualquer agregação anual (DRE Resumo, Dashboard)
que precise agrupar por ANO-CALENDÁRIO de fato, nunca por fatiamento fixo de
índice (`serie[i:i+12]`), que só coincide com o ano real quando o contrato começa
em janeiro. Extraído para módulo compartilhado depois que a mesma lógica precisou
ser corrigida de forma idêntica em routes_dre.py e routes_dashboard.py.
"""
from __future__ import annotations

from datetime import date


def mes_relativo_para_data(data_inicio: date, indice_mes_0based: int) -> date:
    """`indice_mes_0based=0` é o próprio mês de início do contrato (mês 1 do
    projeto). Retorna sempre o dia 1 do mês-calendário correspondente."""
    total_meses = data_inicio.month - 1 + indice_mes_0based
    ano = data_inicio.year + total_meses // 12
    mes = total_meses % 12 + 1
    return date(ano, mes, 1)


def ano_calendario_do_mes_projeto(data_inicio: date, mes_projeto_1based: int) -> int:
    """Mesmo cálculo de `mes_relativo_para_data`, mas recebendo o mês do projeto
    já 1-based (convenção usada em `ResultadoMensal.mes`) e retornando só o ano."""
    return mes_relativo_para_data(data_inicio, mes_projeto_1based - 1).year
