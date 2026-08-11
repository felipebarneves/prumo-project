"""services/calendario.py — extraído de routes_dre.py depois que a mesma lógica de
mês-relativo -> ano-calendário precisou ser corrigida de forma idêntica em
routes_dashboard.py (grafico_dre_por_ano / grafico_fluxo_caixa_por_ano)."""
from datetime import date

from app.modules.viabilidade.services.calendario import (
    ano_calendario_do_mes_projeto,
    mes_relativo_para_data,
)


class TestMesRelativoParaData:
    def test_indice_zero_e_o_proprio_mes_de_inicio(self):
        assert mes_relativo_para_data(date(2026, 3, 1), 0) == date(2026, 3, 1)

    def test_cruza_o_ano_ao_passar_de_dezembro(self):
        assert mes_relativo_para_data(date(2026, 3, 1), 9) == date(2026, 12, 1)
        assert mes_relativo_para_data(date(2026, 3, 1), 10) == date(2027, 1, 1)


class TestAnoCalendarioDoMesProjeto:
    def test_mes_1_do_projeto_e_o_ano_de_inicio(self):
        assert ano_calendario_do_mes_projeto(date(2026, 3, 1), 1) == 2026

    def test_contrato_iniciado_fora_de_janeiro_nao_atribui_ano_errado(self):
        # Início em março/2026: mês 10 do projeto = dezembro/2026 (ainda 2026);
        # mês 11 = janeiro/2027 (já 2027) — o bug antigo em routes_dashboard.py
        # (`inicio_ano + (mes.mes - 1) // 12`, que ignora o MÊS de início) jogava
        # os meses 11 e 12 (jan/fev de 2027) ainda no "ano 0" = 2026.
        assert ano_calendario_do_mes_projeto(date(2026, 3, 1), 10) == 2026
        assert ano_calendario_do_mes_projeto(date(2026, 3, 1), 11) == 2027
        assert ano_calendario_do_mes_projeto(date(2026, 3, 1), 12) == 2027

    def test_contrato_iniciado_em_janeiro_alinha_mes_e_indice(self):
        assert ano_calendario_do_mes_projeto(date(2026, 1, 1), 12) == 2026
        assert ano_calendario_do_mes_projeto(date(2026, 1, 1), 13) == 2027
