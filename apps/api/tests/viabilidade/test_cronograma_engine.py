from decimal import Decimal

from app.modules.viabilidade.services.cronograma_engine import (
    distribuir_volumetria,
    soma_diverge_do_total,
    valor_mensal_calculado,
)


def test_distribuicao_linear_padrao_divide_igualmente():
    resultado = distribuir_volumetria(mes_inicio=1, prazo_meses=4, volumetria_total=Decimal("400"))
    assert resultado == {1: Decimal("100"), 2: Decimal("100"), 3: Decimal("100"), 4: Decimal("100")}


def test_distribuicao_respeita_janela_da_linha_com_mes_inicio_deslocado():
    resultado = distribuir_volumetria(mes_inicio=5, prazo_meses=3, volumetria_total=Decimal("300"))
    assert set(resultado.keys()) == {5, 6, 7}
    assert all(v == Decimal("100") for v in resultado.values())


def test_override_manual_substitui_apenas_a_celula_editada():
    resultado = distribuir_volumetria(
        mes_inicio=1,
        prazo_meses=3,
        volumetria_total=Decimal("300"),
        distribuicao_manual={2: Decimal("250")},
    )
    assert resultado[1] == Decimal("100")
    assert resultado[2] == Decimal("250")
    assert resultado[3] == Decimal("100")


def test_volumetria_total_zero_nao_gera_divisao_por_zero():
    resultado = distribuir_volumetria(mes_inicio=1, prazo_meses=3, volumetria_total=Decimal("0"))
    assert resultado == {1: Decimal("0"), 2: Decimal("0"), 3: Decimal("0")}


def test_prazo_zero_meses_retorna_distribuicao_vazia_sem_erro():
    # Duração < 1 é bloqueada no schema de entrada (PRD 3.3); o motor apenas
    # não deve lançar exceção caso receba um prazo degenerado.
    resultado = distribuir_volumetria(mes_inicio=1, prazo_meses=0, volumetria_total=Decimal("100"))
    assert resultado == {}


def test_soma_diverge_do_total_detecta_divergencia_apos_override():
    distribuicao = distribuir_volumetria(
        mes_inicio=1,
        prazo_meses=2,
        volumetria_total=Decimal("200"),
        distribuicao_manual={1: Decimal("150")},
    )
    assert soma_diverge_do_total(distribuicao, Decimal("200")) is True


def test_soma_nao_diverge_sem_overrides():
    distribuicao = distribuir_volumetria(mes_inicio=1, prazo_meses=2, volumetria_total=Decimal("200"))
    assert soma_diverge_do_total(distribuicao, Decimal("200")) is False


def test_soma_nao_diverge_com_resto_de_dizima_dentro_da_tolerancia():
    # 100 ÷ 3 é uma dízima periódica — mesmo em Decimal de alta precisão, a soma
    # dos 3 meses nunca fecha exatamente 100 (resto na última casa decimal). Isso
    # não é uma divergência real de dado; é o resto esperado da divisão linear, e
    # o alerta "Soma diverge do total" não deveria acender por causa dele
    # (falso positivo — antes desta tolerância, este teste falhava).
    distribuicao = distribuir_volumetria(mes_inicio=1, prazo_meses=3, volumetria_total=Decimal("100"))
    assert soma_diverge_do_total(distribuicao, Decimal("100")) is False


def test_soma_diverge_quando_diferenca_excede_a_tolerancia():
    distribuicao = {1: Decimal("50"), 2: Decimal("49.98")}
    assert soma_diverge_do_total(distribuicao, Decimal("100")) is True


def test_valor_mensal_calculado_multiplica_volumetria_por_unitario():
    distribuicao = {1: Decimal("10"), 2: Decimal("20")}
    valores = valor_mensal_calculado(distribuicao, Decimal("5"))
    assert valores == {1: Decimal("50"), 2: Decimal("100")}
