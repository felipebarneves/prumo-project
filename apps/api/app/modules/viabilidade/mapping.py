"""Tradução entre registros do Supabase (dicts) e os dataclasses puros do motor de cálculo.

Mantém services/ inteiramente livre de detalhes de persistência (PRD/Kaiser: "lógica de
cálculo financeiro desacoplada das rotas da API").
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from . import repository
from .services.models import (
    DespesaNaoOperacionalCalc,
    LinhaCustoCalc,
    LinhaReceitaCalc,
    ParametrosCalc,
    ProjetoCalc,
)


def _dec(valor: Any) -> Decimal:
    return Decimal(str(valor))


def _dec_ou_none(valor: Any) -> Decimal | None:
    return None if valor is None else Decimal(str(valor))


def linha_receita_para_calc(linha: dict[str, Any], contrato: dict[str, Any]) -> LinhaReceitaCalc:
    mes_inicio = linha.get("mes_inicio") or 1
    prazo_meses = linha.get("prazo_meses") or contrato["duracao_meses"]
    distribuicao = repository.listar_distribuicao_receita(UUID(linha["id"]))
    return LinhaReceitaCalc(
        id=linha["id"],
        mes_inicio=mes_inicio,
        prazo_meses=prazo_meses,
        volumetria_total=_dec(linha["volumetria"]),
        valor_unitario=_dec(linha["valor_unitario"]),
        aliquota_especifica=_dec_ou_none(linha.get("aliquota_especifica")),
        distribuicao_manual={mes: _dec(v) for mes, v in distribuicao.items()},
    )


def linha_custo_para_calc(linha: dict[str, Any], contrato: dict[str, Any]) -> LinhaCustoCalc:
    mes_inicio = linha.get("mes_inicio") or 1
    prazo_meses = linha.get("prazo_meses") or contrato["duracao_meses"]
    distribuicao = repository.listar_distribuicao_custo(UUID(linha["id"]))
    return LinhaCustoCalc(
        id=linha["id"],
        mes_inicio=mes_inicio,
        prazo_meses=prazo_meses,
        volumetria_total=_dec(linha["volumetria"]),
        custo_unitario=_dec(linha["custo_unitario"]),
        distribuicao_manual={mes: _dec(v) for mes, v in distribuicao.items()},
    )


def despesa_para_calc(despesa: dict[str, Any]) -> DespesaNaoOperacionalCalc:
    return DespesaNaoOperacionalCalc(
        id=despesa["id"],
        tipo=despesa["tipo"],
        percentual=_dec(despesa["percentual"]),
        linha_receita_referencia_id=despesa.get("linha_receita_referencia_id"),
    )


def parametros_para_calc(parametros: dict[str, Any] | None) -> ParametrosCalc:
    if parametros is None:
        # Versão recém-criada, ainda sem parâmetros gravados (Tela 2 não preenchida).
        return ParametrosCalc(aliquota_tributaria_efetiva=Decimal(0))
    return ParametrosCalc(
        aliquota_tributaria_efetiva=_dec(parametros["aliquota_tributaria_efetiva"]),
        tma=_dec_ou_none(parametros.get("tma")),
        taxa_reinvestimento=_dec_ou_none(parametros.get("taxa_reinvestimento")),
        taxa_custo_captacao=_dec_ou_none(parametros.get("taxa_custo_captacao")),
    )


def projeto_para_calc(contrato: dict[str, Any]) -> ProjetoCalc:
    return ProjetoCalc(
        duracao_meses=contrato["duracao_meses"],
        prazo_pagamento_dias=contrato["prazo_pagamento_dias"],
    )


def carregar_dados_calculo(versao: dict[str, Any], contrato: dict[str, Any]) -> tuple[
    list[LinhaReceitaCalc], list[LinhaCustoCalc], list[DespesaNaoOperacionalCalc], ParametrosCalc, ProjetoCalc
]:
    """Monta o conjunto completo de inputs do motor para uma versão (PRD Telas 2-5)."""
    versao_id = UUID(versao["id"])
    receitas = [linha_receita_para_calc(r, contrato) for r in repository.listar_linhas_receita(versao_id)]
    custos = [linha_custo_para_calc(c, contrato) for c in repository.listar_linhas_custo(versao_id)]
    despesas = [despesa_para_calc(d) for d in repository.listar_despesas(versao_id)]
    parametros = parametros_para_calc(repository.get_parametros_versao(versao_id))
    projeto = projeto_para_calc(contrato)
    return receitas, custos, despesas, parametros, projeto


def carregar_calc_por_versao_id(versao_id: UUID, organization_id: UUID) -> tuple[
    dict[str, Any],
    dict[str, Any],
    tuple[list[LinhaReceitaCalc], list[LinhaCustoCalc], list[DespesaNaoOperacionalCalc], ParametrosCalc, ProjetoCalc],
]:
    """Resolve versão + contrato (com checagem de tenant) e monta os inputs do motor.

    Usado pelas rotas de leitura (DRE, Fluxo de Caixa, Dashboard) e pela Tela 7
    (Comparar Versões / What-If), que precisam do mesmo conjunto de dados para
    rodar o motor sobre uma `versao_id` específica.
    """
    versao = repository.get_versao_or_404(versao_id, organization_id)
    contrato = repository.get_contrato_or_404(UUID(versao["contrato_id"]), organization_id)
    dados_calculo = carregar_dados_calculo(versao, contrato)
    return versao, contrato, dados_calculo
