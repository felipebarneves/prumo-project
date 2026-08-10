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


def _rotulo_periodo(granularidade: GranularidadeResumo, indice_periodo: int, data_inicio: date) -> str:
    if granularidade == GranularidadeResumo.ANUAL:
        return str(data_inicio.year + indice_periodo)
    if granularidade == GranularidadeResumo.TRIMESTRAL:
        return f"T{indice_periodo + 1}"
    return f"S{indice_periodo + 1}"


@router.get("/{versao_id}/dre/resumo", response_model=ResumoDREResponse)
def resumo_dre(
    versao_id: UUID,
    granularidade: GranularidadeResumo = Query(default=GranularidadeResumo.ANUAL),
    current_user: CurrentUser = Depends(get_current_user),
):
    resultado, _, contrato = _calcular_resultado_dre(versao_id, current_user.organization_id)
    meses_por_periodo = {"trimestral": 3, "semestral": 6, "anual": 12}[granularidade.value]
    data_inicio = contrato["data_inicio"] if isinstance(contrato["data_inicio"], date) else date.fromisoformat(contrato["data_inicio"])

    linhas: list[DRELinhaResumo] = []
    for item in _ITENS_SIMPLES + ["ebit_acumulado"]:
        atributo = "ebit_acumulado" if item == "ebit_acumulado" else _MAPA_ATRIBUTO[item]
        serie = resultado.serie(atributo)

        periodos: list[DREPeriodoConsolidado] = []
        for indice_periodo, inicio in enumerate(range(0, len(serie), meses_por_periodo)):
            fatia = serie[inicio : inicio + meses_por_periodo]
            valor = fatia[-1] if item == "ebit_acumulado" else sum(fatia, Decimal(0))
            periodos.append(
                DREPeriodoConsolidado(
                    periodo_label=_rotulo_periodo(granularidade, indice_periodo, data_inicio),
                    valor=valor,
                )
            )

        if item == "ebit_acumulado":
            total = periodos[-1].valor if periodos else Decimal(0)
        else:
            total = sum(serie, Decimal(0))
        linhas.append(DRELinhaResumo(item=item, total_projeto=total, periodos=periodos))

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
