from decimal import Decimal

from app.modules.viabilidade.services.models import LinhaCustoCalc, LinhaReceitaCalc, ParametrosCalc, ProjetoCalc
from app.modules.viabilidade.services.whatif_engine import (
    aplicar_ajustes_custo,
    aplicar_ajustes_receita,
    simular_whatif,
)


def _linha_receita(volumetria="10", valor_unitario="100"):
    return LinhaReceitaCalc(
        id="r1", mes_inicio=1, prazo_meses=1, volumetria_total=Decimal(volumetria), valor_unitario=Decimal(valor_unitario)
    )


def _linha_custo(volumetria="10", custo_unitario="40"):
    return LinhaCustoCalc(
        id="c1", mes_inicio=1, prazo_meses=1, volumetria_total=Decimal(volumetria), custo_unitario=Decimal(custo_unitario)
    )


class TestAjustesIsolados:
    def test_ajuste_de_receita_nao_altera_linhas_de_custo(self):
        # Verificação estrutural: a função de ajuste de receita nem recebe a lista de custo.
        linhas = aplicar_ajustes_receita([_linha_receita()], Decimal("0.10"), Decimal("0"))
        assert linhas[0].valor_unitario == Decimal("110.0")

    def test_ajuste_de_volumetria_receita_nao_afeta_volumetria_de_custo(self):
        receitas = aplicar_ajustes_receita([_linha_receita()], Decimal("0"), Decimal("-0.20"))
        custos = aplicar_ajustes_custo([_linha_custo()], Decimal("0"))
        assert receitas[0].volumetria_total == Decimal("8.0")
        assert custos[0].volumetria_total == Decimal("10")  # inalterada

    def test_ajuste_de_custo_aplica_percentual_sobre_custo_unitario(self):
        custos = aplicar_ajustes_custo([_linha_custo()], Decimal("-0.25"))
        assert custos[0].custo_unitario == Decimal("30.0")


class TestSimularWhatif:
    def test_ajuste_zero_mantem_resultado_simulado_igual_a_base(self):
        parametros = ParametrosCalc(aliquota_tributaria_efetiva=Decimal("0"))
        projeto = ProjetoCalc(duracao_meses=1, prazo_pagamento_dias=0)
        base, simulado = simular_whatif(
            [_linha_receita()], [_linha_custo()], [], parametros, projeto,
            ajuste_receita_pct=Decimal("0"), ajuste_custo_pct=Decimal("0"), ajuste_volumetria_receita_pct=Decimal("0"),
        )
        assert base.receita_bruta == simulado.receita_bruta
        assert base.ebitda == simulado.ebitda

    def test_queda_de_receita_reduz_ebitda_simulado(self):
        parametros = ParametrosCalc(aliquota_tributaria_efetiva=Decimal("0"))
        projeto = ProjetoCalc(duracao_meses=1, prazo_pagamento_dias=0)
        base, simulado = simular_whatif(
            [_linha_receita()], [_linha_custo()], [], parametros, projeto,
            ajuste_receita_pct=Decimal("-0.10"), ajuste_custo_pct=Decimal("0"), ajuste_volumetria_receita_pct=Decimal("0"),
        )
        assert simulado.receita_bruta < base.receita_bruta
        assert simulado.ebitda < base.ebitda

    def test_versao_base_nao_e_alterada_pela_simulacao(self):
        linha_original = _linha_receita()
        parametros = ParametrosCalc(aliquota_tributaria_efetiva=Decimal("0"))
        projeto = ProjetoCalc(duracao_meses=1, prazo_pagamento_dias=0)
        simular_whatif(
            [linha_original], [_linha_custo()], [], parametros, projeto,
            ajuste_receita_pct=Decimal("0.50"), ajuste_custo_pct=Decimal("0"), ajuste_volumetria_receita_pct=Decimal("0"),
        )
        # dataclass é frozen — objeto original permanece intacto independentemente do ajuste aplicado
        assert linha_original.valor_unitario == Decimal("100")
