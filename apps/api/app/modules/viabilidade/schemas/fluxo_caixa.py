"""Tela 5 — Fluxo de Caixa. docs/api-spec-viabilidade.md seção 6."""
from __future__ import annotations

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

FluxoCaixaItem = Literal[
    "entrada_caixa", "deducoes", "saida_caixa", "fluxo_liquido_operacional",
    "despesas_nao_operacionais", "irpj", "fluxo_liquido_geral",
    "fluxo_acumulado", "custo_financeiro", "saldo_caixa_final",
]


class FluxoCaixaLinha(BaseModel):
    item: FluxoCaixaItem
    valores_mensais: list[Decimal]
    total_projeto: Decimal


class FluxoCaixaResponse(BaseModel):
    versao_id: UUID
    meses: list[int]
    linhas: list[FluxoCaixaLinha]
    capital_de_giro: Decimal
