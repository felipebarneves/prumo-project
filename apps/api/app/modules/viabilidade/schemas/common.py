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
    """Status de ciclo de vida do contrato — editável na Tela 1 (Projetos).

    O conjunto ativo, oferecido na UI, é: EM_PROSPECCAO, CONTRATO_ASSINADO,
    EM_EXECUCAO, ENCERRADO, CANCELADO (ver STATUS_OPCOES em
    apps/web/src/app/(dashboard)/viabilidade/page.tsx).

    EM_ELABORACAO/PROPOSTA_ENVIADA/EM_NEGOCIACAO/APROVADO_FECHADO/
    PERDIDO_CANCELADO foram um funil comercial alternativo adicionado e depois
    desativado na UI — permanecem no enum (e no ENUM do Postgres, que não
    permite remover valores) só para não quebrar contratos que já os usem;
    não são mais um destino de edição válido a partir da tabela de Projetos.
    """

    EM_PROSPECCAO = "em_prospeccao"
    CONTRATO_ASSINADO = "contrato_assinado"
    EM_EXECUCAO = "em_execucao"
    ENCERRADO = "encerrado"
    CANCELADO = "cancelado"
    # Desativados na UI — ver docstring acima.
    EM_ELABORACAO = "em_elaboracao"
    PROPOSTA_ENVIADA = "proposta_enviada"
    EM_NEGOCIACAO = "em_negociacao"
    APROVADO_FECHADO = "aprovado_fechado"
    PERDIDO_CANCELADO = "perdido_cancelado"


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
    ORGANIZATION_ID_AUSENTE = "ORGANIZATION_ID_AUSENTE"
    FALHA_AO_CRIAR_CONTRATO = "FALHA_AO_CRIAR_CONTRATO"
    FALHA_AO_LISTAR_CONTRATOS = "FALHA_AO_LISTAR_CONTRATOS"
    CONVITE_NAO_ENCONTRADO = "CONVITE_NAO_ENCONTRADO"
    CONVITE_EXPIRADO = "CONVITE_EXPIRADO"
    CONVITE_JA_UTILIZADO = "CONVITE_JA_UTILIZADO"
    SENHAS_NAO_COINCIDEM = "SENHAS_NAO_COINCIDEM"
    EMAIL_JA_CADASTRADO = "EMAIL_JA_CADASTRADO"
    FALHA_AO_ACEITAR_CONVITE = "FALHA_AO_ACEITAR_CONVITE"
