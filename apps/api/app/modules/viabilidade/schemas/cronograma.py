"""Tela 3 — Cronograma Físico-Financeiro. docs/api-spec-viabilidade.md seção 4."""
from __future__ import annotations

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from .common import ErrorCode


class CelulaCronograma(BaseModel):
    mes: int
    volumetria: Decimal | None
    valor_calculado: Decimal | None
    is_override: bool
    dentro_da_janela: bool


class LinhaCronogramaResponse(BaseModel):
    linha_id: UUID
    descricao: str
    total_linha: Decimal
    soma_distribuicao: Decimal
    divergente: bool
    celulas: list[CelulaCronograma]


class CronogramaResponse(BaseModel):
    versao_id: UUID
    meses: list[int]
    linhas: list[LinhaCronogramaResponse]


class CelulaUpdateRequest(BaseModel):
    mes: int = Field(ge=1)
    volumetria: Decimal = Field(ge=0, decimal_places=4)


class CronogramaCelulasUpdateRequest(BaseModel):
    celulas: list[CelulaUpdateRequest] = Field(min_length=1)


class CronogramaCelulasUpdateResponse(BaseModel):
    linha_id: UUID
    soma_distribuicao: Decimal
    total_linha: Decimal
    warning: Literal[ErrorCode.DISTRIBUICAO_SOMA_DIVERGENTE] | None = None
