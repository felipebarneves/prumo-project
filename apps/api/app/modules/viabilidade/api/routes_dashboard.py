"""Tela 6 — Dashboard do Projeto / Tela 8 — Home da Organização. 100% leitura.

docs/api-spec-viabilidade.md seções 7 e 9.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends

from .. import mapping, repository
from ..schemas.dashboard import (
    DashboardKPIs,
    DashboardProjetoResponse,
    GraficoAnualSerie,
    GraficoFluxoCaixaAnualSerie,
    HomeOrganizacaoKPIs,
    HomeOrganizacaoResponse,
)
from ..services.calendario import ano_calendario_do_mes_projeto
from ..services.decimal_utils import divisao_segura
from ..services.kpi_engine import breakeven_mes, capital_de_giro, payback_mes, tir, tirm, vpl
from ..services.motor import calcular_projeto
from .deps import CurrentUser, get_current_user

router = APIRouter(prefix="/api/v1", tags=["dashboard"])


@router.get("/versoes/{versao_id}/dashboard", response_model=DashboardProjetoResponse)
def dashboard_projeto(versao_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    _, contrato, (receitas, custos, despesas, parametros, projeto) = mapping.carregar_calc_por_versao_id(
        versao_id, current_user.organization_id
    )
    resultado = calcular_projeto(receitas, custos, despesas, parametros, projeto)
    resultado_dre = [m for m in resultado.meses if m.mes <= contrato["duracao_meses"]]

    receita_bruta_total = sum((m.receita_bruta for m in resultado_dre), Decimal(0))
    ebitda_total = sum((m.ebitda for m in resultado_dre), Decimal(0))

    kpis = DashboardKPIs(
        receita_bruta_total=receita_bruta_total,
        ebitda_total=ebitda_total,
        margem_ebitda=divisao_segura(ebitda_total, receita_bruta_total) or Decimal(0),
        # "Fluxo Líquido Total" precisa bater com a linha "Fluxo Líquido Geral" do
        # Fluxo de Caixa (routes_fluxo_caixa.py) — soma da série mensal, igual lá.
        # Antes somava "saldo_caixa_final", que é saldo CORRENTE (running balance):
        # somar meses de um saldo corrente não tem significado financeiro (o mesmo
        # bug já corrigido no total_projeto do Fluxo de Caixa) e nunca bateria com
        # nenhum número exibido em nenhuma outra tela.
        fluxo_liquido_total=resultado.total("fluxo_liquido_geral"),
        vpl=vpl(resultado, parametros.tma),
        tir=tir(resultado),
        tirm=tirm(resultado, parametros.tma, parametros.taxa_reinvestimento),
        payback_mes=payback_mes(resultado),
        breakeven_mes=breakeven_mes(resultado),
        capital_de_giro=capital_de_giro(resultado),
        custo_financeiro_total=resultado.total("custo_financeiro"),
    )

    # Agrupamento por ANO-CALENDÁRIO real de cada mês — nunca `inicio_ano + (mes.mes
    # - 1) // 12`, que ignora o MÊS de início do contrato (só usa o .year) e por
    # isso atribui o ano errado a qualquer contrato que não comece em janeiro (ex:
    # início em março/2026 — o antigo cálculo jogava jan-fev/2027, que são meses 11
    # e 12 do projeto, no "ano 0" = 2026, quando na verdade já são 2027). Mesma
    # correção já aplicada ao Resumo da DRE (routes_dre.py) — ver services/calendario.py.
    data_inicio_contrato = (
        contrato["data_inicio"]
        if isinstance(contrato["data_inicio"], date)
        else date.fromisoformat(str(contrato["data_inicio"]))
    )
    por_ano_dre: dict[int, list] = defaultdict(list)
    for mes in resultado_dre:
        ano = ano_calendario_do_mes_projeto(data_inicio_contrato, mes.mes)
        por_ano_dre[ano].append(mes)

    grafico_dre = [
        GraficoAnualSerie(
            ano=ano,
            receita_liquida=sum((m.receita_liquida for m in meses), Decimal(0)),
            custos=sum((m.custos_operacionais for m in meses), Decimal(0)),
            ebitda=sum((m.ebitda for m in meses), Decimal(0)),
        )
        for ano, meses in sorted(por_ano_dre.items())
    ]

    por_ano_fluxo: dict[int, list] = defaultdict(list)
    for mes in resultado.meses:
        ano = ano_calendario_do_mes_projeto(data_inicio_contrato, mes.mes)
        por_ano_fluxo[ano].append(mes)

    grafico_fluxo = [
        GraficoFluxoCaixaAnualSerie(
            ano=ano,
            fluxo_anual=sum((m.fluxo_liquido_geral for m in meses), Decimal(0)),
            caixa_acumulado=meses[-1].fluxo_acumulado,
        )
        for ano, meses in sorted(por_ano_fluxo.items())
    ]

    return DashboardProjetoResponse(
        versao_id=versao_id, kpis=kpis, grafico_dre_por_ano=grafico_dre, grafico_fluxo_caixa_por_ano=grafico_fluxo
    )


@router.get("/organizations/me/home", response_model=HomeOrganizacaoResponse)
def home_organizacao(current_user: CurrentUser = Depends(get_current_user)):
    """PRD Tela 8 — usa sempre a versão mais recente de cada projeto não-arquivado."""
    contratos, _ = repository.listar_contratos(
        current_user.organization_id, {"mostrar_arquivados": False}, page=1, page_size=1000
    )

    receita_bruta_total = Decimal(0)
    ebitda_total = Decimal(0)

    for contrato in contratos:
        versoes = repository.listar_versoes(UUID(contrato["id"]))
        if not versoes:
            continue  # projeto sem parametrização suficiente — excluído do somatório sem erro (PRD 3.9)
        versao_mais_recente = versoes[0]  # já ordenado por created_at desc (repository.listar_versoes)

        receitas, custos, despesas, parametros, projeto = mapping.carregar_dados_calculo(versao_mais_recente, contrato)
        if not receitas and not custos:
            continue

        resultado = calcular_projeto(receitas, custos, despesas, parametros, projeto)
        resultado_dre = [m for m in resultado.meses if m.mes <= contrato["duracao_meses"]]
        receita_bruta_total += sum((m.receita_bruta for m in resultado_dre), Decimal(0))
        ebitda_total += sum((m.ebitda for m in resultado_dre), Decimal(0))

    capacidade = repository.get_plan_capacity(current_user.plan_tier)
    contratos_ativos = repository.contar_contratos_ativos(current_user.organization_id)

    kpis = HomeOrganizacaoKPIs(
        receita_bruta_total=receita_bruta_total,
        ebitda_total=ebitda_total,
        margem_ebitda=divisao_segura(ebitda_total, receita_bruta_total) or Decimal(0),
        contratos_ativos_atual=contratos_ativos,
        contratos_ativos_limite=capacidade["max_active_contracts"],
    )
    return HomeOrganizacaoResponse(kpis=kpis)
