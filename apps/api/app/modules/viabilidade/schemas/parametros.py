"""Tela 2 — Parâmetros Gerais da Versão. docs/api-spec-viabilidade.md seção 3."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class ParametrosVersaoRequest(BaseModel):
    aliquota_tributaria_efetiva: Decimal = Field(ge=0, decimal_places=4)
    tma: Decimal | None = Field(default=None, ge=0, decimal_places=4)
    taxa_reinvestimento: Decimal | None = Field(default=None, ge=0, decimal_places=4)
    taxa_custo_captacao: Decimal | None = Field(default=None, ge=0, decimal_places=4)


class ParametrosVersaoResponse(ParametrosVersaoRequest):
    versao_id: UUID
    updated_at: datetime
