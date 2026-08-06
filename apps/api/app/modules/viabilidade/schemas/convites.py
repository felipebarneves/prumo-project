"""Tela 10 — Aceite de Convite (variação da tela de Login). docs/prd/viabilidade/02-backend-api.md seção 11."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator

from .common import OrganizationRole


class ConviteDetalheResponse(BaseModel):
    """E-mail e papel são pré-preenchidos e não-editáveis na tela de aceite (PRD 04-auth-integrations.md)."""

    email: str
    role: OrganizationRole
    organization_nome: str


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
