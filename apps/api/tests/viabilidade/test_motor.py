from decimal import Decimal

from app.modules.viabilidade.services.models import (
    DespesaNaoOperacionalCalc,
    LinhaCustoCalc,
    LinhaReceitaCalc,
    ParametrosCalc,
    ProjetoCalc,
)
from app.modules.viabilidade.services.motor import calcular_irpj, calcular_projeto


class TestCalcularIrpj:
    def test_ebit_negativo_nao_gera_irpj(self):
        assert calcular_irpj(Decimal("-400")) == Decimal(0)

    def test_ebit_zero_nao_gera_irpj(self):
        assert calcular_irpj(Decimal("0")) == Decimal(0)

    def test_ebit_abaixo_do_limite_aplica_apenas_aliquota_base(self):
        assert calcular_irpj(Decimal("540")) == Decimal("81.00")

    def test_ebit_acima_do_limite_aplica_aliquota_base_mais_adicional(self):
        # 15% sobre 50000 (=7500) + 10% sobre o excedente de 20000 (30000 -> 3000) = 10500
        assert calcular_irpj(Decimal("50000")) == Decimal("10500.00")

    def test_ebit_exatamente_no_limite_nao_aplica_adicional(self):
        assert calcular_irpj(Decimal("20000")) == Decimal("3000.00")


class TestCalcularProjetoCompetenciaPura:
    """Cenário sem deslocamento de prazo de pagamento (dias=0) — competência == caixa."""

    def _resultado(self):
        receitas = [
            LinhaReceitaCalc(
                id="r1", mes_inicio=1, prazo_meses=3, volumetria_total=Decimal(3), valor_unitario=Decimal(1000)
            )
        ]
        custos = [
            LinhaCustoCalc(
                id="c1", mes_inicio=1, prazo_meses=3, volumetria_total=Decimal(3), custo_unitario=Decimal(400)
            )
        ]
        parametros = ParametrosCalc(aliquota_tributaria_efetiva=Decimal("0.06"))
        projeto = ProjetoCalc(duracao_meses=3, prazo_pagamento_dias=0)
        return calcular_projeto(receitas, custos, [], parametros, projeto)

    def test_horizonte_sem_deslocamento_igual_a_duracao(self):
        resultado = self._resultado()
        assert len(resultado.meses) == 3

    def test_dre_mensal_calculado_corretamente(self):
        mes1 = self._resultado().meses[0]
        assert mes1.receita_bruta == Decimal("1000")
        assert mes1.deducoes == Decimal("60.00")
        assert mes1.receita_liquida == Decimal("940.00")
        assert mes1.custos_operacionais == Decimal("400")
        assert mes1.ebitda == Decimal("540.00")
        assert mes1.ebit == Decimal("540.00")
        assert mes1.irpj == Decimal("81.0000")
        assert mes1.lucro_liquido == Decimal("459.0000")

    def test_ebit_acumulado_soma_ao_longo_dos_meses(self):
        meses = self._resultado().meses
        assert meses[2].ebit_acumulado == meses[0].ebit + meses[1].ebit + meses[2].ebit

    def test_sem_deslocamento_entrada_caixa_igual_a_receita_bruta(self):
        for mes in self._resultado().meses:
            assert mes.entrada_caixa == mes.receita_bruta

    def test_fluxo_acumulado_cresce_mes_a_mes(self):
        meses = self._resultado().meses
        assert meses[1].fluxo_acumulado > meses[0].fluxo_acumulado
        assert meses[2].fluxo_acumulado > meses[1].fluxo_acumulado

    def test_sem_taxa_custo_captacao_saldo_caixa_final_igual_fluxo_acumulado(self):
        for mes in self._resultado().meses:
            assert mes.custo_financeiro == Decimal(0)
            assert mes.saldo_caixa_final == mes.fluxo_acumulado


class TestDespesasNaoOperacionais:
    def test_despesa_reduz_e_recuperacao_aumenta_resultado(self):
        receitas = [
            LinhaReceitaCalc(
                id="r1", mes_inicio=1, prazo_meses=1, volumetria_total=Decimal(1), valor_unitario=Decimal(1000)
            )
        ]
        despesas = [
            DespesaNaoOperacionalCalc(id="d1", tipo="despesa", percentual=Decimal("0.10")),
            DespesaNaoOperacionalCalc(id="d2", tipo="recuperacao", percentual=Decimal("0.05")),
        ]
        parametros = ParametrosCalc(aliquota_tributaria_efetiva=Decimal("0"))
        projeto = ProjetoCalc(duracao_meses=1, prazo_pagamento_dias=0)
        resultado = calcular_projeto(receitas, [], despesas, parametros, projeto)
        mes1 = resultado.meses[0]

        # despesa: 1000*0.10=100 (soma) ; recuperacao: 1000*0.05=50 (subtrai)
        assert mes1.despesas_nao_operacionais_exceto_cf == Decimal("50.00")
        assert mes1.ebitda == Decimal("1000")
        assert mes1.ebit == Decimal("950.00")

    def test_despesa_referenciando_linha_de_receita_especifica_usa_apenas_aquela_base(self):
        receitas = [
            LinhaReceitaCalc(
                id="ref", mes_inicio=1, prazo_meses=1, volumetria_total=Decimal(1), valor_unitario=Decimal(1000)
            ),
            LinhaReceitaCalc(
                id="outra", mes_inicio=1, prazo_meses=1, volumetria_total=Decimal(1), valor_unitario=Decimal(5000)
            ),
        ]
        despesas = [
            DespesaNaoOperacionalCalc(
                id="d1", tipo="despesa", percentual=Decimal("0.10"), linha_receita_referencia_id="ref"
            )
        ]
        parametros = ParametrosCalc(aliquota_tributaria_efetiva=Decimal("0"))
        projeto = ProjetoCalc(duracao_meses=1, prazo_pagamento_dias=0)
        resultado = calcular_projeto(receitas, [], despesas, parametros, projeto)
        mes1 = resultado.meses[0]
        # 10% apenas sobre a linha "ref" (1000), não sobre a receita bruta total (6000)
        assert mes1.despesas_nao_operacionais_exceto_cf == Decimal("100.00")


class TestDeslocamentoDeReceitaPorPrazoDePagamento:
    def test_receita_e_deslocada_e_custo_permanece_em_competencia(self):
        receitas = [
            LinhaReceitaCalc(
                id="r1", mes_inicio=1, prazo_meses=1, volumetria_total=Decimal(1), valor_unitario=Decimal(1000)
            )
        ]
        parametros = ParametrosCalc(aliquota_tributaria_efetiva=Decimal("0"))
        projeto = ProjetoCalc(duracao_meses=1, prazo_pagamento_dias=60)  # deslocamento = 2 meses
        resultado = calcular_projeto(receitas, [], [], parametros, projeto)

        assert len(resultado.meses) == 3  # duracao(1) + deslocamento(2)
        assert resultado.meses[0].entrada_caixa == Decimal(0)
        assert resultado.meses[1].entrada_caixa == Decimal(0)
        assert resultado.meses[2].entrada_caixa == Decimal("1000")
        # DRE (competência) só reconhece receita no mês 1, independentemente do deslocamento de caixa
        assert resultado.meses[0].receita_bruta == Decimal("1000")
        assert resultado.meses[1].receita_bruta == Decimal(0)
        assert resultado.meses[2].receita_bruta == Decimal(0)


class TestCustoFinanceiroSequencial:
    """Custo Financeiro do mês N usa o Fluxo Acumulado do mês N-1 — nunca o do mês corrente (PRD 3.6)."""

    def test_custo_financeiro_depende_do_fluxo_acumulado_anterior_nao_do_atual(self):
        custos = [
            LinhaCustoCalc(
                id="c1", mes_inicio=1, prazo_meses=1, volumetria_total=Decimal(1), custo_unitario=Decimal(1000)
            ),
            LinhaCustoCalc(
                id="c2", mes_inicio=2, prazo_meses=1, volumetria_total=Decimal(1), custo_unitario=Decimal(500)
            ),
        ]
        parametros = ParametrosCalc(aliquota_tributaria_efetiva=Decimal("0"), taxa_custo_captacao=Decimal("0.10"))
        projeto = ProjetoCalc(duracao_meses=2, prazo_pagamento_dias=0)
        resultado = calcular_projeto([], custos, [], parametros, projeto)

        mes1, mes2 = resultado.meses
        assert mes1.fluxo_acumulado == Decimal("-1000")
        # Custo financeiro do mês 1 é zero: fluxo acumulado do mês 0 (base) é zero, não negativo.
        assert mes1.custo_financeiro == Decimal(0)
        # Custo financeiro do mês 2 = 10% sobre o saldo negativo do mês 1 (-1000), não sobre o do mês 2.
        assert mes2.custo_financeiro == Decimal("100.00")
        assert mes2.fluxo_acumulado == Decimal("-1500")
        assert mes2.saldo_caixa_final == Decimal("-1600.00")

    def test_taxa_custo_captacao_none_gera_custo_financeiro_zero(self):
        custos = [
            LinhaCustoCalc(
                id="c1", mes_inicio=1, prazo_meses=1, volumetria_total=Decimal(1), custo_unitario=Decimal(1000)
            )
        ]
        parametros = ParametrosCalc(aliquota_tributaria_efetiva=Decimal("0"), taxa_custo_captacao=None)
        projeto = ProjetoCalc(duracao_meses=2, prazo_pagamento_dias=0)
        resultado = calcular_projeto([], custos, [], parametros, projeto)
        assert all(mes.custo_financeiro == Decimal(0) for mes in resultado.meses)

    def test_fluxo_acumulado_positivo_nao_gera_custo_financeiro(self):
        receitas = [
            LinhaReceitaCalc(
                id="r1", mes_inicio=1, prazo_meses=2, volumetria_total=Decimal(2), valor_unitario=Decimal(1000)
            )
        ]
        parametros = ParametrosCalc(aliquota_tributaria_efetiva=Decimal("0"), taxa_custo_captacao=Decimal("0.10"))
        projeto = ProjetoCalc(duracao_meses=2, prazo_pagamento_dias=0)
        resultado = calcular_projeto(receitas, [], [], parametros, projeto)
        assert all(mes.custo_financeiro == Decimal(0) for mes in resultado.meses)


class TestAliquotaPorLinhaDeReceita:
    def test_linhas_com_aliquotas_diferentes_sao_deduzidas_individualmente(self):
        receitas = [
            LinhaReceitaCalc(
                id="r1",
                mes_inicio=1,
                prazo_meses=1,
                volumetria_total=Decimal(1),
                valor_unitario=Decimal(1000),
                aliquota_especifica=Decimal("0.02"),
            ),
            LinhaReceitaCalc(
                id="r2",
                mes_inicio=1,
                prazo_meses=1,
                volumetria_total=Decimal(1),
                valor_unitario=Decimal(1000),
                # sem alíquota específica -> herda a geral
            ),
        ]
        parametros = ParametrosCalc(aliquota_tributaria_efetiva=Decimal("0.06"))
        projeto = ProjetoCalc(duracao_meses=1, prazo_pagamento_dias=0)
        resultado = calcular_projeto(receitas, [], [], parametros, projeto)
        mes1 = resultado.meses[0]

        # 1000*0.02 + 1000*0.06 = 20 + 60 = 80 -- nunca (2000 * aliquota geral 0.06 = 120)
        assert mes1.deducoes == Decimal("80.00")
