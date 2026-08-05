from decimal import Decimal

from app.modules.viabilidade.services.decimal_utils import (
    arredondar_2_casas,
    divisao_segura,
    zero_se_none,
)


def test_arredondamento_half_up_arredonda_para_cima_no_ponto_medio():
    assert arredondar_2_casas(Decimal("10.005")) == Decimal("10.01")


def test_arredondamento_preserva_valores_ja_com_duas_casas():
    assert arredondar_2_casas(Decimal("10.10")) == Decimal("10.10")


def test_zero_se_none_retorna_zero_para_none():
    assert zero_se_none(None) == Decimal(0)


def test_zero_se_none_retorna_o_proprio_valor_quando_presente():
    assert zero_se_none(Decimal("42")) == Decimal("42")


def test_divisao_segura_retorna_none_para_denominador_zero():
    assert divisao_segura(Decimal("100"), Decimal("0")) is None


def test_divisao_segura_calcula_normalmente():
    assert divisao_segura(Decimal("100"), Decimal("4")) == Decimal("25")


def test_divisao_segura_com_numerador_zero_e_denominador_valido_retorna_zero():
    assert divisao_segura(Decimal("0"), Decimal("4")) == Decimal("0")
