"""Tela 7 — Cenários / What-If / Versões. docs/api-spec-viabilidade.md seção 8."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from .common import SnapshotTipo


class VersaoCreateRequest(BaseModel):
    nome_versao: str = Field(min_length=1, max_length=120)
    origem_versao_id: UUID | None = None


class VersaoResponse(BaseModel):
    id: UUID
    contrato_id: UUID
    nome_versao: str
    origem_versao_id: UUID | None
    criado_por: UUID
    created_at: datetime
    vinculo_precificacao_ativo: bool


class VersaoRenameRequest(BaseModel):
    nome_versao: str = Field(min_length=1, max_length=120)


class VersaoDeleteResponse(BaseModel):
    versao_id_excluida: UUID
    versao_substituta_id: UUID | None


class ComparacaoRequest(BaseModel):
    versao_a_id: UUID
    versao_b_id: UUID


class ComparacaoMetricas(BaseModel):
    receita_bruta: Decimal
    impostos: Decimal
    receita_liquida: Decimal
    custos_totais: Decimal
    ebitda: Decimal
    margem_ebitda: Decimal
    payback_mes: int | None


class ComparacaoResponse(BaseModel):
    versao_a: ComparacaoMetricas
    versao_b: ComparacaoMetricas


class WhatIfRequest(BaseModel):
    versao_base_id: UUID
    ajuste_receita_pct: Decimal = Field(default=Decimal(0), decimal_places=4)
    ajuste_custo_pct: Decimal = Field(default=Decimal(0), decimal_places=4)
    ajuste_volumetria_receita_pct: Decimal = Field(default=Decimal(0), decimal_places=4)


class WhatIfResponse(BaseModel):
    versao_base: ComparacaoMetricas
    resultado_simulado: ComparacaoMetricas
    ajustes_aplicados: WhatIfRequest


class SnapshotCreateRequest(BaseModel):
    tipo: SnapshotTipo
    nome: str = Field(min_length=1, max_length=120)
    versao_a_id: UUID
    versao_b_id: UUID | None = None
    ajustes_whatif: WhatIfRequest | None = None
    resultado: ComparacaoResponse | WhatIfResponse


class SnapshotResponse(BaseModel):
    id: UUID
    contrato_id: UUID
    tipo: SnapshotTipo
    nome: str
    versao_a_id: UUID
    versao_b_id: UUID | None
    resultado: dict
    created_by: UUID
    created_at: datetime
