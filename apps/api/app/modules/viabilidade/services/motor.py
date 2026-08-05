"""Motor de cálculo único — Cronograma → DRE → Fluxo de Caixa (PRD seções 3.5 e 3.6).

Por que DRE e Fluxo de Caixa são calculados juntos, em uma única passada sequencial
mês a mês, em vez de dois motores separados: o EBIT do DRE inclui a linha de Custo
Financeiro (PRD Tela 2 seção 5b / Tela 4 seção 2), mas o Custo Financeiro do mês N é
calculado a partir do Fluxo Acumulado do mês N-1 (Tela 5, Passo 2). Calcular os dois
separadamente reintroduziria a recursão que o "passada única" foi desenhado para
evitar. Este motor resolve isso computando cada mês em ordem cronológica, usando
sempre o Fluxo Acumulado já consolidado do mês anterior.
"""
from __future__ import annotations

from decimal import Decimal

from .cronograma_engine import distribuir_volumetria
from .models import (
    DespesaNaoOperacionalCalc,
    LinhaCustoCalc,
    LinhaReceitaCalc,
    ParametrosCalc,
    ProjetoCalc,
    ResultadoMensal,
    ResultadoProjeto,
)

LIMITE_IRPJ_ADICIONAL = Decimal("20000")
ALIQUOTA_IRPJ_BASE = Decimal("0.15")
ALIQUOTA_IRPJ_ADICIONAL = Decimal("0.10")


def calcular_irpj(ebit_mes: Decimal) -> Decimal:
    """PRD 3.5 — fórmula única e simplificada, igual para os dois regimes tributários."""
    if ebit_mes <= 0:
        return Decimal(0)
    excedente = max(ebit_mes - LIMITE_IRPJ_ADICIONAL, Decimal(0))
    return ebit_mes * ALIQUOTA_IRPJ_BASE + excedente * ALIQUOTA_IRPJ_ADICIONAL


def _valor_mensal_por_linha(
    linhas: list[LinhaReceitaCalc] | list[LinhaCustoCalc], campo_unitario: str
) -> dict[str, dict[int, Decimal]]:
    resultado: dict[str, dict[int, Decimal]] = {}
    for linha in linhas:
        distribuicao = distribuir_volumetria(
            linha.mes_inicio, linha.prazo_meses, linha.volumetria_total, linha.distribuicao_manual
        )
        unitario = getattr(linha, campo_unitario)
        resultado[linha.id] = {mes: vol * unitario for mes, vol in distribuicao.items()}
    return resultado


def calcular_projeto(
    receitas: list[LinhaReceitaCalc],
    custos: list[LinhaCustoCalc],
    despesas: list[DespesaNaoOperacionalCalc],
    parametros: ParametrosCalc,
    projeto: ProjetoCalc,
) -> ResultadoProjeto:
    duracao = projeto.duracao_meses
    deslocamento = projeto.deslocamento_meses
    horizonte_total = duracao + deslocamento  # meses extras só para capturar recebimento deslocado

    valores_receita_por_linha = _valor_mensal_por_linha(receitas, "valor_unitario")
    valores_custo_por_linha = _valor_mensal_por_linha(custos, "custo_unitario")

    def receita_bruta_mes(mes: int) -> Decimal:
        if mes < 1 or mes > duracao:
            return Decimal(0)
        return sum((v.get(mes, Decimal(0)) for v in valores_receita_por_linha.values()), Decimal(0))

    def deducoes_mes(mes: int) -> Decimal:
        if mes < 1 or mes > duracao:
            return Decimal(0)
        total = Decimal(0)
        for linha in receitas:
            valor_linha = valores_receita_por_linha[linha.id].get(mes, Decimal(0))
            aliquota = linha.aliquota_especifica if linha.aliquota_especifica is not None else parametros.aliquota_tributaria_efetiva
            total += valor_linha * aliquota
        return total

    def custos_operacionais_mes(mes: int) -> Decimal:
        if mes < 1 or mes > duracao:
            return Decimal(0)
        return sum((v.get(mes, Decimal(0)) for v in valores_custo_por_linha.values()), Decimal(0))

    def despesas_exceto_cf_mes(mes: int) -> Decimal:
        """Valor líquido a subtrair do EBITDA. Despesa soma (+), Recuperação subtrai (-)."""
        if mes < 1 or mes > duracao:
            return Decimal(0)
        receita_total_mes = receita_bruta_mes(mes)
        total = Decimal(0)
        for despesa in despesas:
            if despesa.linha_receita_referencia_id is not None:
                base = valores_receita_por_linha.get(despesa.linha_receita_referencia_id, {}).get(mes, Decimal(0))
            else:
                base = receita_total_mes
            efeito = despesa.percentual * base
            total += efeito if despesa.tipo == "despesa" else -efeito
        return total

    resultados: list[ResultadoMensal] = []
    fluxo_acumulado_anterior = Decimal(0)
    custo_financeiro_acumulado = Decimal(0)
    ebit_acumulado_anterior = Decimal(0)

    for mes in range(1, horizonte_total + 1):
        receita_bruta = receita_bruta_mes(mes)
        deducoes = deducoes_mes(mes)
        receita_liquida = receita_bruta - deducoes
        custos_operacionais = custos_operacionais_mes(mes)
        ebitda = receita_liquida - custos_operacionais
        desp_exceto_cf = despesas_exceto_cf_mes(mes)

        if parametros.taxa_custo_captacao is not None:
            saldo_negativo_anterior = -min(fluxo_acumulado_anterior, Decimal(0))
            custo_financeiro = parametros.taxa_custo_captacao * saldo_negativo_anterior
        else:
            custo_financeiro = Decimal(0)

        despesas_total = desp_exceto_cf + custo_financeiro
        ebit = ebitda - despesas_total
        irpj = calcular_irpj(ebit)
        lucro_liquido = ebit - irpj
        ebit_acumulado = ebit_acumulado_anterior + ebit

        mes_origem_receita = mes - deslocamento
        entrada_caixa = receita_bruta_mes(mes_origem_receita) if mes_origem_receita >= 1 else Decimal(0)
        saida_caixa = custos_operacionais
        fluxo_liquido_operacional = entrada_caixa - deducoes - saida_caixa
        fluxo_liquido_geral = fluxo_liquido_operacional - desp_exceto_cf - irpj
        fluxo_acumulado = fluxo_acumulado_anterior + fluxo_liquido_geral
        custo_financeiro_acumulado += custo_financeiro
        saldo_caixa_final = fluxo_acumulado - custo_financeiro_acumulado

        resultados.append(
            ResultadoMensal(
                mes=mes,
                receita_bruta=receita_bruta,
                deducoes=deducoes,
                receita_liquida=receita_liquida,
                custos_operacionais=custos_operacionais,
                ebitda=ebitda,
                despesas_nao_operacionais_exceto_cf=desp_exceto_cf,
                custo_financeiro=custo_financeiro,
                despesas_nao_operacionais_total=despesas_total,
                ebit=ebit,
                irpj=irpj,
                lucro_liquido=lucro_liquido,
                entrada_caixa=entrada_caixa,
                saida_caixa=saida_caixa,
                fluxo_liquido_operacional=fluxo_liquido_operacional,
                fluxo_liquido_geral=fluxo_liquido_geral,
                fluxo_acumulado=fluxo_acumulado,
                saldo_caixa_final=saldo_caixa_final,
                ebit_acumulado=ebit_acumulado,
            )
        )

        fluxo_acumulado_anterior = fluxo_acumulado
        ebit_acumulado_anterior = ebit_acumulado

    return ResultadoProjeto(meses=resultados)
