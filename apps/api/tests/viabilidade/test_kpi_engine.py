from decimal import Decimal

from app.modules.viabilidade.services.kpi_engine import (
    breakeven_mes,
    capital_de_giro,
    payback_mes,
    tir,
    tirm,
    vpl,
)
from app.modules.viabilidade.services.kpi_engine import _npv  # uso interno, apenas para validar convergência em teste
from app.modules.viabilidade.services.models import ResultadoMensal, ResultadoProjeto


def _mensal(mes: int, fluxo_acumulado="0", saldo_caixa_final="0", fluxo_liquido_geral="0") -> ResultadoMensal:
    zero = Decimal(0)
    return ResultadoMensal(
        mes=mes,
        receita_bruta=zero,
        deducoes=zero,
        receita_liquida=zero,
        custos_operacionais=zero,
        ebitda=zero,
        despesas_nao_operacionais_exceto_cf=zero,
        custo_financeiro=zero,
        despesas_nao_operacionais_total=zero,
        ebit=zero,
        irpj=zero,
        lucro_liquido=zero,
        entrada_caixa=zero,
        saida_caixa=zero,
        fluxo_liquido_operacional=zero,
        fluxo_liquido_geral=Decimal(fluxo_liquido_geral),
        fluxo_acumulado=Decimal(fluxo_acumulado),
        saldo_caixa_final=Decimal(saldo_caixa_final),
        ebit_acumulado=zero,
    )


class TestCapitalDeGiro:
    def test_retorna_o_maior_valor_negativo_do_fluxo_acumulado(self):
        resultado = ResultadoProjeto(
            meses=[
                _mensal(1, fluxo_acumulado="-500"),
                _mensal(2, fluxo_acumulado="-1200"),
                _mensal(3, fluxo_acumulado="-300"),
                _mensal(4, fluxo_acumulado="800"),
            ]
        )
        assert capital_de_giro(resultado) == Decimal("-1200")

    def test_retorna_zero_quando_fluxo_nunca_e_negativo(self):
        resultado = ResultadoProjeto(meses=[_mensal(1, fluxo_acumulado="100"), _mensal(2, fluxo_acumulado="200")])
        assert capital_de_giro(resultado) == Decimal(0)


class TestPayback:
    def test_detecta_cruzamento_de_negativo_para_positivo(self):
        resultado = ResultadoProjeto(
            meses=[
                _mensal(1, fluxo_acumulado="-1000"),
                _mensal(2, fluxo_acumulado="-400"),
                _mensal(3, fluxo_acumulado="200"),
            ]
        )
        assert payback_mes(resultado) == 3

    def test_retorna_none_quando_nunca_atinge_positivo(self):
        resultado = ResultadoProjeto(meses=[_mensal(1, fluxo_acumulado="-1000"), _mensal(2, fluxo_acumulado="-500")])
        assert payback_mes(resultado) is None

    def test_retorna_none_quando_fluxo_sempre_positivo_sem_cruzamento(self):
        # Nunca esteve negativo -> não há "cruzamento" formal (PRD 3.7 exige negativo->positivo).
        resultado = ResultadoProjeto(meses=[_mensal(1, fluxo_acumulado="100"), _mensal(2, fluxo_acumulado="200")])
        assert payback_mes(resultado) is None


class TestBreakeven:
    def test_primeiro_mes_com_resultado_mensal_isolado_positivo(self):
        resultado = ResultadoProjeto(
            meses=[
                _mensal(1, fluxo_liquido_geral="-100"),
                _mensal(2, fluxo_liquido_geral="-50"),
                _mensal(3, fluxo_liquido_geral="10"),
            ]
        )
        assert breakeven_mes(resultado) == 3

    def test_retorna_none_se_nunca_positivo(self):
        resultado = ResultadoProjeto(meses=[_mensal(1, fluxo_liquido_geral="-10"), _mensal(2, fluxo_liquido_geral="0")])
        assert breakeven_mes(resultado) is None


class TestVpl:
    def test_retorna_none_quando_tma_nao_preenchida(self):
        resultado = ResultadoProjeto(meses=[_mensal(1, saldo_caixa_final="1000")])
        assert vpl(resultado, None) is None

    def test_calcula_valor_presente_liquido_com_tma(self):
        resultado = ResultadoProjeto(meses=[_mensal(1, saldo_caixa_final="1100")])
        resultado_vpl = vpl(resultado, Decimal("0.10"))
        assert resultado_vpl == Decimal("1000")  # 1100 / 1.10

    def test_vpl_zero_permitido_como_resultado_valido(self):
        resultado = ResultadoProjeto(meses=[_mensal(1, saldo_caixa_final="0")])
        assert vpl(resultado, Decimal("0.10")) == Decimal(0)


class TestTir:
    def test_retorna_none_sem_troca_de_sinal(self):
        resultado = ResultadoProjeto(
            meses=[_mensal(1, saldo_caixa_final="100"), _mensal(2, saldo_caixa_final="200")]
        )
        assert tir(resultado) is None

    def test_calcula_taxa_que_zera_o_npv(self):
        # Fluxo clássico: investimento seguido de retornos constantes — TIR conhecida ~ 19.44%
        resultado = ResultadoProjeto(
            meses=[
                _mensal(1, saldo_caixa_final="-1000"),
                _mensal(2, saldo_caixa_final="400"),
                _mensal(3, saldo_caixa_final="400"),
                _mensal(4, saldo_caixa_final="400"),
            ]
        )
        taxa = tir(resultado)
        assert taxa is not None
        fluxos = [Decimal("-1000"), Decimal("400"), Decimal("400"), Decimal("400")]
        assert abs(_npv(fluxos, taxa)) < Decimal("0.01")

    def test_retorna_none_quando_todos_os_fluxos_sao_zero(self):
        resultado = ResultadoProjeto(meses=[_mensal(1, saldo_caixa_final="0"), _mensal(2, saldo_caixa_final="0")])
        assert tir(resultado) is None


class TestTirm:
    def test_retorna_none_sem_tma(self):
        resultado = ResultadoProjeto(
            meses=[_mensal(1, saldo_caixa_final="-1000"), _mensal(2, saldo_caixa_final="1500")]
        )
        assert tirm(resultado, None, Decimal("0.05")) is None

    def test_retorna_none_sem_taxa_reinvestimento(self):
        resultado = ResultadoProjeto(
            meses=[_mensal(1, saldo_caixa_final="-1000"), _mensal(2, saldo_caixa_final="1500")]
        )
        assert tirm(resultado, Decimal("0.05"), None) is None

    def test_calcula_valor_positivo_para_projeto_lucrativo(self):
        resultado = ResultadoProjeto(
            meses=[
                _mensal(1, saldo_caixa_final="-1000"),
                _mensal(2, saldo_caixa_final="600"),
                _mensal(3, saldo_caixa_final="600"),
            ]
        )
        taxa = tirm(resultado, Decimal("0.05"), Decimal("0.03"))
        assert taxa is not None
        assert taxa > Decimal(0)

    def test_retorna_none_quando_nao_ha_fluxos_negativos(self):
        resultado = ResultadoProjeto(meses=[_mensal(1, saldo_caixa_final="100"), _mensal(2, saldo_caixa_final="200")])
        assert tirm(resultado, Decimal("0.05"), Decimal("0.03")) is None
