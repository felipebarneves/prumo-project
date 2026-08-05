from decimal import Decimal

import pytest

from app.modules.viabilidade.services.models import (
    DespesaNaoOperacionalCalc,
    LinhaCustoCalc,
    LinhaReceitaCalc,
    ParametrosCalc,
    ProjetoCalc,
)


@pytest.fixture
def projeto_12_meses() -> ProjetoCalc:
    return ProjetoCalc(duracao_meses=12, prazo_pagamento_dias=30)


@pytest.fixture
def parametros_basicos() -> ParametrosCalc:
    return ParametrosCalc(
        aliquota_tributaria_efetiva=Decimal("0.06"),
        tma=Decimal("0.01"),
        taxa_reinvestimento=Decimal("0.005"),
        taxa_custo_captacao=Decimal("0.02"),
    )


@pytest.fixture
def linha_receita_simples() -> LinhaReceitaCalc:
    return LinhaReceitaCalc(
        id="receita-1",
        mes_inicio=1,
        prazo_meses=12,
        volumetria_total=Decimal("120"),
        valor_unitario=Decimal("1000"),
    )


@pytest.fixture
def linha_custo_simples() -> LinhaCustoCalc:
    return LinhaCustoCalc(
        id="custo-1",
        mes_inicio=1,
        prazo_meses=12,
        volumetria_total=Decimal("120"),
        custo_unitario=Decimal("400"),
    )


@pytest.fixture
def sem_despesas() -> list[DespesaNaoOperacionalCalc]:
    return []
