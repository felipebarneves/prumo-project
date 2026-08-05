"""Enums e schemas compartilhados — docs/api-spec-viabilidade.md, seções 0.2-0.4."""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: dict[str, Any] | None = None


class OrganizationRole(str, Enum):
    OWNER = "owner"
    EXECUTOR = "executor"
    VIEWER = "viewer"


class RegimeTributario(str, Enum):
    LUCRO_PRESUMIDO = "lucro_presumido"
    LUCRO_REAL = "lucro_real"


class StatusCicloVida(str, Enum):
    EM_PROSPECCAO = "em_prospeccao"
    CONTRATO_ASSINADO = "contrato_assinado"
    EM_EXECUCAO = "em_execucao"
    ENCERRADO = "encerrado"
    CANCELADO = "cancelado"


class PrazoPagamento(int, Enum):
    D30 = 30
    D60 = 60
    D90 = 90


class ModuloPrumo(str, Enum):
    PRECIFICACAO = "precificacao"
    GESTAO = "gestao"


class DespesaTipo(str, Enum):
    DESPESA = "despesa"
    RECUPERACAO = "recuperacao"


class SnapshotTipo(str, Enum):
    COMPARACAO = "comparacao"
    WHATIF = "whatif"


class GranularidadeResumo(str, Enum):
    TRIMESTRAL = "trimestral"
    SEMESTRAL = "semestral"
    ANUAL = "anual"


class PlanTier(str, Enum):
    STARTER = "starter"
    PRO_PLANEJAMENTO = "pro_planejamento"
    PRO_EXECUCAO = "pro_execucao"
    MASTER = "master"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    INACTIVE = "inactive"


# Códigos de erro financeiro padronizados (docs/api-spec-viabilidade.md seção 0.2)
class ErrorCode(str, Enum):
    LIMITE_PLANO_EXCEDIDO = "LIMITE_PLANO_EXCEDIDO"
    ASSINATURA_BLOQUEIA_ESCRITA = "ASSINATURA_BLOQUEIA_ESCRITA"
    REGIME_TRIBUTARIO_IMUTAVEL = "REGIME_TRIBUTARIO_IMUTAVEL"
    JANELA_LINHA_EXCEDIDA = "JANELA_LINHA_EXCEDIDA"
    LINHA_BLOQUEADA_POR_ORIGEM = "LINHA_BLOQUEADA_POR_ORIGEM"
    LINHA_BLOQUEADA_POR_OVERRIDE = "LINHA_BLOQUEADA_POR_OVERRIDE"
    DISTRIBUICAO_SOMA_DIVERGENTE = "DISTRIBUICAO_SOMA_DIVERGENTE"
    VERSAO_UNICA_NAO_EXCLUIVEL = "VERSAO_UNICA_NAO_EXCLUIVEL"
    DURACAO_INVALIDA = "DURACAO_INVALIDA"
    VALOR_NEGATIVO = "VALOR_NEGATIVO"
