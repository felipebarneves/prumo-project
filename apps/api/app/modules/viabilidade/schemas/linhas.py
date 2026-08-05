"""Tela 2 — Linhas de Receita e Custo. docs/api-spec-viabilidade.md seção 3."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class LinhaReceitaCreateRequest(BaseModel):
    descricao: str = Field(min_length=1, max_length=300)
    mes_inicio: int | None = Field(default=None, ge=1)
    prazo_meses: int | None = Field(default=None, ge=1)
    unidade_medida: str = Field(min_length=1, max_length=40)
    volumetria: Decimal = Field(ge=0, decimal_places=4)
    valor_unitario: Decimal = Field(ge=0, decimal_places=4)
    aliquota_especifica: Decimal | None = Field(default=None, ge=0, decimal_places=4)


class LinhaReceitaUpdateRequest(BaseModel):
    descricao: str | None = None
    mes_inicio: int | None = None
    prazo_meses: int | None = None
    unidade_medida: str | None = None
    volumetria: Decimal | None = Field(default=None, ge=0, decimal_places=4)
    valor_unitario: Decimal | None = Field(default=None, ge=0, decimal_places=4)
    aliquota_especifica: Decimal | None = None


class LinhaReceitaResponse(BaseModel):
    id: UUID
    versao_id: UUID
    descricao: str
    mes_inicio: int | None
    prazo_meses: int | None
    unidade_medida: str
    volumetria: Decimal
    valor_unitario: Decimal
    valor_total_calculado: Decimal
    aliquota_especifica: Decimal | None
    origem_line_id: UUID | None
    bloqueado_por_origem: bool
    bloqueado_por_override: bool
    created_at: datetime
    updated_at: datetime


class LinhaCustoCreateRequest(BaseModel):
    descricao: str = Field(min_length=1, max_length=300)
    mes_inicio: int | None = Field(default=None, ge=1)
    prazo_meses: int | None = Field(default=None, ge=1)
    unidade_medida: str = Field(min_length=1, max_length=40)
    volumetria: Decimal = Field(ge=0, decimal_places=4)
    custo_unitario: Decimal = Field(ge=0, decimal_places=4)


class LinhaCustoUpdateRequest(BaseModel):
    descricao: str | None = None
    mes_inicio: int | None = None
    prazo_meses: int | None = None
    unidade_medida: str | None = None
    volumetria: Decimal | None = Field(default=None, ge=0, decimal_places=4)
    custo_unitario: Decimal | None = Field(default=None, ge=0, decimal_places=4)


class LinhaCustoResponse(BaseModel):
    id: UUID
    versao_id: UUID
    descricao: str
    mes_inicio: int | None
    prazo_meses: int | None
    unidade_medida: str
    volumetria: Decimal
    custo_unitario: Decimal
    custo_total_calculado: Decimal
    origem_line_id: UUID | None
    bloqueado_por_origem: bool
    bloqueado_por_override: bool
    created_at: datetime
    updated_at: datetime
