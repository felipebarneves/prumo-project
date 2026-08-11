"""Tela 4 — Resumo DRE, agregação anual por ano-calendário real (não por
fatiamento fixo de 12 índices). Ver apps/api/app/modules/viabilidade/api/routes_dre.py.
"""
from datetime import date
from decimal import Decimal

from app.modules.viabilidade.api.routes_dre import (
    _mes_relativo_para_data,
    _periodos_anuais_calendario,
    _periodos_anuais_calendario_acumulado,
)


class TestMesRelativoParaData:
    def test_indice_zero_e_o_proprio_mes_de_inicio(self):
        assert _mes_relativo_para_data(date(2026, 3, 1), 0) == date(2026, 3, 1)

    def test_avanca_para_o_ano_seguinte_ao_cruzar_dezembro(self):
        # início em março/2026, índice 9 = 10º mês do projeto = dezembro/2026
        assert _mes_relativo_para_data(date(2026, 3, 1), 9) == date(2026, 12, 1)
        # índice 10 = 11º mês do projeto = janeiro/2027
        assert _mes_relativo_para_data(date(2026, 3, 1), 10) == date(2027, 1, 1)

    def test_contrato_iniciado_em_janeiro_mantem_indice_e_mes_alinhados(self):
        assert _mes_relativo_para_data(date(2026, 1, 1), 11) == date(2026, 12, 1)
        assert _mes_relativo_para_data(date(2026, 1, 1), 12) == date(2027, 1, 1)


class TestPeriodosAnuaisCalendario:
    def test_contrato_iniciado_em_janeiro_agrupa_em_blocos_de_12_como_antes(self):
        # Caso feliz do bug antigo — janeiro sempre coincidiu com fatiamento por
        # índice, então nunca reproduzia o bug. Continua correto após a correção.
        serie = [Decimal(100)] * 24
        periodos = _periodos_anuais_calendario(serie, date(2026, 1, 1))
        assert [(p.periodo_label, p.valor) for p in periodos] == [
            ("2026", Decimal(1200)),
            ("2027", Decimal(1200)),
        ]

    def test_contrato_iniciado_fora_de_janeiro_tem_ano_calendario_parcial(self):
        # Início em março/2026, 14 meses: mar-dez/2026 (10 meses) + jan-abr/2027 (4 meses).
        # O bug antigo faria serie[0:12] = "2026" (mar/2026-fev/2027, ano errado nos
        # últimos 2 meses) e serie[12:14] = "2027" (só 2 meses, mar-abr/2027 perdidos
        # do total do "ano 1").
        serie = [Decimal(100)] * 14
        periodos = _periodos_anuais_calendario(serie, date(2026, 3, 1))
        assert [(p.periodo_label, p.valor) for p in periodos] == [
            ("2026", Decimal(1000)),  # 10 meses (mar-dez)
            ("2027", Decimal(400)),  # 4 meses (jan-abr)
        ]

    def test_contrato_sem_atividade_em_um_ano_intermediario_soma_zero_nao_omite(self):
        # 26 meses a partir de janeiro/2026: 2026 (12 meses de 100), 2027 (12 meses
        # de 0 — projeto sem faturamento naquele ano), 2028 (2 meses de 100).
        serie = [Decimal(100)] * 12 + [Decimal(0)] * 12 + [Decimal(100)] * 2
        periodos = _periodos_anuais_calendario(serie, date(2026, 1, 1))
        assert [(p.periodo_label, p.valor) for p in periodos] == [
            ("2026", Decimal(1200)),
            ("2027", Decimal(0)),
            ("2028", Decimal(200)),
        ]

    def test_contrato_iniciado_em_2027_nao_gera_coluna_fantasma_de_2026(self):
        serie = [Decimal(50)] * 6
        periodos = _periodos_anuais_calendario(serie, date(2027, 1, 1))
        assert [p.periodo_label for p in periodos] == ["2027"]


class TestPeriodosAnuaisCalendarioAcumulado:
    def test_pega_o_ultimo_mes_de_cada_ano_nao_a_soma(self):
        # EBIT Acumulado é saldo corrente — o valor do ano é o do último mês dele,
        # nunca a soma dos meses (que dobraria/distorceria o acumulado).
        serie = [Decimal(v) for v in [10, 20, 30, 40, 50]]  # 5 meses a partir de nov/2026
        periodos = _periodos_anuais_calendario_acumulado(serie, date(2026, 11, 1))
        # nov/2026=10, dez/2026=20 -> ano 2026 termina em 20; jan-mar/2027=30,40,50 -> termina em 50
        assert [(p.periodo_label, p.valor) for p in periodos] == [
            ("2026", Decimal(20)),
            ("2027", Decimal(50)),
        ]
