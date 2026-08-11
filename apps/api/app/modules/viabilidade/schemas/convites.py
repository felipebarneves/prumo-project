"""Tela 10 — Aceite de Convite (variação da tela de Login). docs/prd/viabilidade/02-backend-api.md seção 11."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from .common import OrganizationRole


class ConviteDetalheResponse(BaseModel):
    """E-mail e papel são pré-preenchidos e não-editáveis na tela de aceite (PRD 04-auth-integrations.md)."""

    email: str
    role: OrganizationRole
    organization_nome: str


class ConviteCreateRequest(BaseModel):
    """Tela de Configurações — aba Membros e Permissões, modal '+ Convidar Membro'.
    Owner não convida outro Owner por aqui (só executor/viewer, PRD 3.10).

    E-mail validado por regex simples (não `EmailStr`) — o pacote `email-validator`
    não está nas dependências do backend; validação estrita de deliverability não é
    necessária aqui, o convite falha de forma inofensiva se o e-mail não existir.
    """

    email: str = Field(min_length=3, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: OrganizationRole = Field(default=OrganizationRole.VIEWER)

    @model_validator(mode="after")
    def _validar_role_convidavel(self) -> "ConviteCreateRequest":
        if self.role == OrganizationRole.OWNER:
            raise ValueError("Não é possível convidar um novo membro diretamente como Owner.")
        return self


class ConviteCreateResponse(BaseModel):
    id: UUID
    email: str
    role: OrganizationRole
    status: str
    expires_at: str


class ConviteAceitarRequest(BaseModel):
    nome_usuario: str = Field(min_length=1, max_length=120)
    senha: str = Field(min_length=8, max_length=72)
    confirmar_senha: str = Field(min_length=8, max_length=72)

    @model_validator(mode="after")
    def _validar_senhas_coincidem(self) -> "ConviteAceitarRequest":
        if self.senha != self.confirmar_senha:
            raise ValueError("As senhas informadas não coincidem.")
        return self


class ConviteAceitarResponse(BaseModel):
    user_id: UUID
    organization_id: UUID
    role: OrganizationRole
