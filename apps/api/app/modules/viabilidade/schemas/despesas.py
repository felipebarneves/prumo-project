"""Tela 2, seção 5b — Despesas Não Operacionais. docs/api-spec-viabilidade.md seção 3."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from .common import DespesaTipo


class DespesaNaoOperacionalCreateRequest(BaseModel):
    descricao: str = Field(min_length=1, max_length=300)
    tipo: DespesaTipo
    percentual: Decimal = Field(ge=0, decimal_places=4)
    linha_receita_referencia_id: UUID | None = None


class DespesaNaoOperacionalUpdateRequest(BaseModel):
    descricao: str | None = None
    tipo: DespesaTipo | None = None
    percentual: Decimal | None = Field(default=None, ge=0, decimal_places=4)
    linha_receita_referencia_id: UUID | None = None


class DespesaNaoOperacionalResponse(DespesaNaoOperacionalCreateRequest):
    id: UUID
    versao_id: UUID
    created_at: datetime
    updated_at: datetime


class CustoFinanceiroProjecaoResponse(BaseModel):
    """Linha automática, não editável — GET only (PRD Tela 2, seção 5b)."""

    valores_mensais: list[Decimal]
    total: Decimal
