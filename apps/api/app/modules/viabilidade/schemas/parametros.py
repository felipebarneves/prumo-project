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
    # None enquanto a versão não tiver nenhum parametros_versao gravado ainda
    # (fallback em routes_parametros.obter_parametros) — nunca assumir que toda
    # versão já tem um registro só porque ela existe.
    updated_at: datetime | None
