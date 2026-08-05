"""Estruturas de dados puras do motor de cálculo — desacopladas de Pydantic/HTTP e de persistência.

Os serviços em services/ operam exclusivamente sobre estes dataclasses. As rotas em api/
são responsáveis por traduzir registros do banco (via repository.py) para estes tipos, e o
resultado do motor de volta para os schemas de resposta (schemas/).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Literal


@dataclass(frozen=True)
class LinhaReceitaCalc:
    id: str
    mes_inicio: int
    prazo_meses: int
    volumetria_total: Decimal
    valor_unitario: Decimal
    aliquota_especifica: Decimal | None = None
    # overrides manuais de distribuição (Tela 3) — mes -> volumetria. Vazio = distribuição linear.
    distribuicao_manual: dict[int, Decimal] = field(default_factory=dict)

    @property
    def possui_override(self) -> bool:
        return len(self.distribuicao_manual) > 0

    @property
    def mes_fim(self) -> int:
        return self.mes_inicio + self.prazo_meses - 1


@dataclass(frozen=True)
class LinhaCustoCalc:
    id: str
    mes_inicio: int
    prazo_meses: int
    volumetria_total: Decimal
    custo_unitario: Decimal
    distribuicao_manual: dict[int, Decimal] = field(default_factory=dict)

    @property
    def possui_override(self) -> bool:
        return len(self.distribuicao_manual) > 0

    @property
    def mes_fim(self) -> int:
        return self.mes_inicio + self.prazo_meses - 1


@dataclass(frozen=True)
class DespesaNaoOperacionalCalc:
    id: str
    tipo: Literal["despesa", "recuperacao"]
    percentual: Decimal
    linha_receita_referencia_id: str | None = None


@dataclass(frozen=True)
class ParametrosCalc:
    aliquota_tributaria_efetiva: Decimal
    tma: Decimal | None = None
    taxa_reinvestimento: Decimal | None = None
    taxa_custo_captacao: Decimal | None = None


@dataclass(frozen=True)
class ProjetoCalc:
    duracao_meses: int
    prazo_pagamento_dias: int  # 30 | 60 | 90

    @property
    def deslocamento_meses(self) -> int:
        """PRD 3.6 — offset de recebimento de Receita. 60 dias = 2 meses (60 // 30)."""
        return self.prazo_pagamento_dias // 30


@dataclass(frozen=True)
class ResultadoMensal:
    mes: int
    receita_bruta: Decimal
    deducoes: Decimal
    receita_liquida: Decimal
    custos_operacionais: Decimal
    ebitda: Decimal
    despesas_nao_operacionais_exceto_cf: Decimal  # valor líquido a subtrair (despesa +, recuperação -)
    custo_financeiro: Decimal
    despesas_nao_operacionais_total: Decimal
    ebit: Decimal
    irpj: Decimal
    lucro_liquido: Decimal
    entrada_caixa: Decimal
    saida_caixa: Decimal
    fluxo_liquido_operacional: Decimal
    fluxo_liquido_geral: Decimal
    fluxo_acumulado: Decimal
    saldo_caixa_final: Decimal
    ebit_acumulado: Decimal


@dataclass(frozen=True)
class ResultadoProjeto:
    meses: list[ResultadoMensal]

    def serie(self, atributo: str) -> list[Decimal]:
        return [getattr(m, atributo) for m in self.meses]

    def total(self, atributo: str) -> Decimal:
        return sum(self.serie(atributo), Decimal(0))
