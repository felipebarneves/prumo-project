"""Tela 4 — DRE Detalhado + Resumo DRE. 100% leitura. docs/api-spec-viabilidade.md seção 5."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from .. import mapping
from ..schemas.common import GranularidadeResumo
from ..schemas.dre import (
    NOTA_IRPJ,
    DREDetalhadoResponse,
    DREItemMensal,
    DRELinha,
    DRELinhaResumo,
    DREPeriodoConsolidado,
    ResumoDREResponse,
)
from ..services.decimal_utils import divisao_segura
from ..services.models import ResultadoProjeto
from ..services.motor import calcular_projeto
from .deps import CurrentUser, get_current_user

router = APIRouter(prefix="/api/v1/versoes", tags=["dre"])

_ITENS_SIMPLES = [
    "receita_operacional_bruta", "deducoes", "receita_operacional_liquida",
    "custos_operacionais", "ebitda", "despesas_nao_operacionais", "ebit", "irpj", "lucro_liquido",
]

_MAPA_ATRIBUTO = {
    "receita_operacional_bruta": "receita_bruta",
    "deducoes": "deducoes",
    "receita_operacional_liquida": "receita_liquida",
    "custos_operacionais": "custos_operacionais",
    "ebitda": "ebitda",
    "despesas_nao_operacionais": "despesas_nao_operacionais_total",
    "ebit": "ebit",
    "irpj": "irpj",
    "lucro_liquido": "lucro_liquido",
}


def _calcular_resultado_dre(versao_id: UUID, organization_id: UUID) -> tuple[ResultadoProjeto, dict, dict]:
    versao, contrato, (receitas, custos, despesas, parametros, projeto) = mapping.carregar_calc_por_versao_id(
        versao_id, organization_id
    )
    resultado = calcular_projeto(receitas, custos, despesas, parametros, projeto)
    # DRE não inclui os meses extras de deslocamento de caixa — apenas a duração do projeto.
    resultado_dre = ResultadoProjeto(meses=[m for m in resultado.meses if m.mes <= contrato["duracao_meses"]])
    return resultado_dre, versao, contrato


@router.get("/{versao_id}/dre/detalhado", response_model=DREDetalhadoResponse)
def dre_detalhado(versao_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    resultado, _, contrato = _calcular_resultado_dre(versao_id, current_user.organization_id)
    meses = [m.mes for m in resultado.meses]

    linhas: list[DRELinha] = []
    for item in _ITENS_SIMPLES:
        atributo = _MAPA_ATRIBUTO[item]
        serie = resultado.serie(atributo)
        linhas.append(
            DRELinha(
                item=item,
                total_projeto=sum(serie, Decimal(0)),
                valores_mensais=[DREItemMensal(mes=m, valor=v) for m, v in zip(meses, serie)],
            )
        )

    # EBIT Acumulado — única linha com coluna de acumulado no MVP (PRD 3.5).
    ebit_acumulado_serie = resultado.serie("ebit_acumulado")
    linhas.append(
        DRELinha(
            item="ebit_acumulado",
            total_projeto=ebit_acumulado_serie[-1] if ebit_acumulado_serie else Decimal(0),
            valores_mensais=[DREItemMensal(mes=m, valor=v) for m, v in zip(meses, ebit_acumulado_serie)],
        )
    )

    for item, base_attr in [
        ("margem_ebitda", "ebitda"),
        ("margem_ebit", "ebit"),
        ("margem_liquida", "lucro_liquido"),
    ]:
        receitas_mes = resultado.serie("receita_bruta")
        base_mes = resultado.serie(base_attr)
        margens = [divisao_segura(b, r) or Decimal(0) for b, r in zip(base_mes, receitas_mes)]
        total_receita = sum(receitas_mes, Decimal(0))
        total_base = sum(base_mes, Decimal(0))
        linhas.append(
            DRELinha(
                item=item,
                total_projeto=divisao_segura(total_base, total_receita) or Decimal(0),
                valores_mensais=[DREItemMensal(mes=m, valor=v) for m, v in zip(meses, margens)],
            )
        )

    return DREDetalhadoResponse(versao_id=versao_id, meses=meses, linhas=linhas, nota_irpj=NOTA_IRPJ)


# Ordem de exibição do Resumo — espelha a DRE Detalhada (indicadores logo abaixo
# do item a que se referem), em vez da ordem de cálculo.
_ORDEM_RESUMO = [
    "receita_operacional_bruta", "deducoes", "receita_operacional_liquida",
    "custos_operacionais", "ebitda", "margem_ebitda", "despesas_nao_operacionais",
    "ebit", "ebit_acumulado", "margem_ebit", "irpj", "lucro_liquido", "margem_liquida",
]


def _rotulo_periodo(granularidade: GranularidadeResumo, indice_periodo: int) -> str:
    """Rótulo project-relativo — só usado para trimestral/semestral (T1/T2.../S1/S2),
    que não têm o bug de ano-calendário: são sempre relativos ao início do projeto,
    nunca rotulados com um ano civil que poderia estar errado. A granularidade ANUAL
    usa `_periodos_anuais_calendario*` abaixo, rotulada com o ano-calendário real."""
    if granularidade == GranularidadeResumo.TRIMESTRAL:
        return f"T{indice_periodo + 1}"
    return f"S{indice_periodo + 1}"


def _mes_relativo_para_data(data_inicio: date, indice_mes: int) -> date:
    """Mês relativo 0-based (posição na série mensal, mês 1 do projeto = índice 0)
    convertido para a data-calendário real daquele mês."""
    total_meses = data_inicio.month - 1 + indice_mes
    ano = data_inicio.year + total_meses // 12
    mes = total_meses % 12 + 1
    return date(ano, mes, 1)


def _periodos_anuais_calendario(serie: list[Decimal], data_inicio: date) -> list[DREPeriodoConsolidado]:
    """Agrupa uma série mensal por ANO-CALENDÁRIO real de cada mês — nunca por
    fatiamento fixo `serie[i:i+12]` a partir do índice 0. Um contrato iniciado fora
    de janeiro tem anos-calendário parciais (ex: início em março → 10 meses no
    1º ano-calendário, 12 no 2º); fatiar por índice atribuiria meses ao ano errado
    e rotularia com `data_inicio.year + indice_periodo`, que só é o ano real quando
    o contrato começa em janeiro. Cada ano-calendário que o projeto efetivamente
    atravessa aparece com a soma real dos seus meses (0 se todos forem zero) —
    não há coluna fantasma fora do intervalo do contrato nem coluna faltando dentro
    dele.
    """
    somas_por_ano: dict[int, Decimal] = {}
    for indice, valor in enumerate(serie):
        ano = _mes_relativo_para_data(data_inicio, indice).year
        somas_por_ano[ano] = somas_por_ano.get(ano, Decimal(0)) + valor
    return [DREPeriodoConsolidado(periodo_label=str(ano), valor=soma) for ano, soma in sorted(somas_por_ano.items())]


def _periodos_anuais_calendario_acumulado(serie: list[Decimal], data_inicio: date) -> list[DREPeriodoConsolidado]:
    """Mesmo agrupamento por ano-calendário de `_periodos_anuais_calendario`, mas
    para séries de saldo acumulado (ex: EBIT Acumulado) — pega o valor do ÚLTIMO
    mês de cada ano-calendário em vez de somar os meses."""
    ultimo_por_ano: dict[int, Decimal] = {}
    for indice, valor in enumerate(serie):
        ano = _mes_relativo_para_data(data_inicio, indice).year
        ultimo_por_ano[ano] = valor  # sobrescrito a cada mês — a última atribuição é o último mês do ano
    return [DREPeriodoConsolidado(periodo_label=str(ano), valor=valor) for ano, valor in sorted(ultimo_por_ano.items())]


@router.get("/{versao_id}/dre/resumo", response_model=ResumoDREResponse)
def resumo_dre(
    versao_id: UUID,
    granularidade: GranularidadeResumo = Query(default=GranularidadeResumo.ANUAL),
    current_user: CurrentUser = Depends(get_current_user),
):
    resultado, _, contrato = _calcular_resultado_dre(versao_id, current_user.organization_id)
    meses_por_periodo = {"trimestral": 3, "semestral": 6, "anual": 12}[granularidade.value]
    data_inicio = contrato["data_inicio"] if isinstance(contrato["data_inicio"], date) else date.fromisoformat(contrato["data_inicio"])
    eh_anual = granularidade == GranularidadeResumo.ANUAL

    def rotulos_periodos(quantidade: int) -> list[str]:
        # Só chamada para trimestral/semestral — ANUAL usa _periodos_anuais_calendario*,
        # que rotula por ano-calendário real em vez de índice de período.
        return [_rotulo_periodo(granularidade, i) for i in range(quantidade)]

    def periodos_soma(serie: list[Decimal]) -> list[DREPeriodoConsolidado]:
        if eh_anual:
            return _periodos_anuais_calendario(serie, data_inicio)
        rotulos = rotulos_periodos(len(range(0, len(serie), meses_por_periodo)))
        return [
            DREPeriodoConsolidado(periodo_label=rotulo, valor=sum(serie[i : i + meses_por_periodo], Decimal(0)))
            for rotulo, i in zip(rotulos, range(0, len(serie), meses_por_periodo))
        ]

    linhas_por_item: dict[str, DRELinhaResumo] = {}
    series_por_item: dict[str, list[Decimal]] = {}
    for item in _ITENS_SIMPLES:
        serie = resultado.serie(_MAPA_ATRIBUTO[item])
        series_por_item[item] = serie
        linhas_por_item[item] = DRELinhaResumo(
            item=item, total_projeto=sum(serie, Decimal(0)), periodos=periodos_soma(serie)
        )

    ebit_acumulado_serie = resultado.serie("ebit_acumulado")
    if eh_anual:
        periodos_ea = _periodos_anuais_calendario_acumulado(ebit_acumulado_serie, data_inicio)
    else:
        rotulos = rotulos_periodos(len(range(0, len(ebit_acumulado_serie), meses_por_periodo)))
        periodos_ea = [
            DREPeriodoConsolidado(periodo_label=rotulo, valor=ebit_acumulado_serie[i : i + meses_por_periodo][-1])
            for rotulo, i in zip(rotulos, range(0, len(ebit_acumulado_serie), meses_por_periodo))
        ]
    linhas_por_item["ebit_acumulado"] = DRELinhaResumo(
        item="ebit_acumulado",
        total_projeto=periodos_ea[-1].valor if periodos_ea else Decimal(0),
        periodos=periodos_ea,
    )

    receita_serie = series_por_item["receita_operacional_bruta"]
    for item, base_item in [
        ("margem_ebitda", "ebitda"),
        ("margem_ebit", "ebit"),
        ("margem_liquida", "lucro_liquido"),
    ]:
        base_serie = series_por_item[base_item]
        if eh_anual:
            somas_base: dict[int, Decimal] = {}
            somas_receita: dict[int, Decimal] = {}
            for indice, (base_mes, receita_mes) in enumerate(zip(base_serie, receita_serie)):
                ano = _mes_relativo_para_data(data_inicio, indice).year
                somas_base[ano] = somas_base.get(ano, Decimal(0)) + base_mes
                somas_receita[ano] = somas_receita.get(ano, Decimal(0)) + receita_mes
            periodos = [
                DREPeriodoConsolidado(
                    periodo_label=str(ano),
                    valor=divisao_segura(somas_base[ano], somas_receita[ano]) or Decimal(0),
                )
                for ano in sorted(somas_base)
            ]
        else:
            rotulos = rotulos_periodos(len(range(0, len(base_serie), meses_por_periodo)))
            periodos = [
                DREPeriodoConsolidado(
                    periodo_label=rotulo,
                    valor=divisao_segura(
                        sum(base_serie[i : i + meses_por_periodo], Decimal(0)),
                        sum(receita_serie[i : i + meses_por_periodo], Decimal(0)),
                    )
                    or Decimal(0),
                )
                for rotulo, i in zip(rotulos, range(0, len(base_serie), meses_por_periodo))
            ]
        total = divisao_segura(sum(base_serie, Decimal(0)), sum(receita_serie, Decimal(0))) or Decimal(0)
        linhas_por_item[item] = DRELinhaResumo(item=item, total_projeto=total, periodos=periodos)

    linhas = [linhas_por_item[item] for item in _ORDEM_RESUMO]

    fim_contrato = date(data_inicio.year, data_inicio.month, 1) + timedelta(days=31 * contrato["duracao_meses"])

    return ResumoDREResponse(
        versao_id=versao_id,
        granularidade=granularidade,
        inicio_projeto=data_inicio,
        fim_contrato=fim_contrato,
        prazo_meses=contrato["duracao_meses"],
        linhas=linhas,
        nota_irpj=NOTA_IRPJ,
    )
