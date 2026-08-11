"""Tela 1 — Cadastro e Consulta de Projetos/Contratos. docs/api-spec-viabilidade.md seção 2."""
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from .common import ModuloPrumo, PrazoPagamento, RegimeTributario, StatusCicloVida


class ContratoCreateRequest(BaseModel):
    nome_projeto: str = Field(min_length=1, max_length=200)
    cliente: str = Field(min_length=1, max_length=200)
    data_inicio: date
    duracao_meses: int = Field(ge=1)
    nome_contrato: str = Field(min_length=1, max_length=200)
    prazo_pagamento_dias: PrazoPagamento
    nome_versao: str = Field(min_length=1, max_length=120)
    regime_tributario: RegimeTributario
    status_ciclo_vida: StatusCicloVida = StatusCicloVida.EM_PROSPECCAO
    codigo_interno: str | None = None
    segmento_cliente_final: str | None = None
    observacoes: str | None = None


class ContratoResponse(BaseModel):
    id: UUID
    organization_id: UUID
    nome_projeto: str
    cliente: str
    data_inicio: date
    duracao_meses: int
    nome_contrato: str
    prazo_pagamento_dias: int
    regime_tributario: RegimeTributario
    status_ciclo_vida: StatusCicloVida
    moeda: str = "BRL"
    codigo_interno: str | None
    segmento_cliente_final: str | None
    observacoes: str | None = None
    arquivado_em: datetime | None
    modulos_vinculados: list[ModuloPrumo]
    versao_inicial_id: UUID
    created_at: datetime


class ContratoUpdateRequest(BaseModel):
    """regime_tributario e moeda não são campos aceitos aqui — imutáveis (PRD 3.2)."""

    nome_projeto: str | None = None
    cliente: str | None = None
    data_inicio: date | None = None
    duracao_meses: int | None = Field(default=None, ge=1)
    nome_contrato: str | None = None
    prazo_pagamento_dias: PrazoPagamento | None = None
    status_ciclo_vida: StatusCicloVida | None = None
    codigo_interno: str | None = None
    segmento_cliente_final: str | None = None
    observacoes: str | None = None


class ContratoListQuery(BaseModel):
    status_ciclo_vida: StatusCicloVida | None = None
    modulo_vinculado: ModuloPrumo | None = None
    mostrar_arquivados: bool = False
    busca: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, le=100)


class ContratoListItem(BaseModel):
    id: UUID
    nome_projeto: str
    cliente: str
    status_ciclo_vida: StatusCicloVida
    modulos_vinculados: list[ModuloPrumo]
    arquivado: bool
    created_at: datetime


class ContratoListResponse(BaseModel):
    items: list[ContratoListItem]
    total: int
    page: int
    page_size: int


class ArquivarContratoResponse(BaseModel):
    contrato_id: UUID
    modulos_afetados: list[ModuloPrumo]
    arquivado_em: datetime


class VincularModuloRequest(BaseModel):
    modulo: ModuloPrumo
    contrato_origem_id: UUID


class VincularModuloResponse(BaseModel):
    id: UUID
    contrato_id: UUID
    modulo: ModuloPrumo
    contrato_origem_id: UUID
    linhas_importadas_receita: int
    linhas_importadas_custo: int
    vinculado_em: datetime
