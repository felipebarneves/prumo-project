"""Tela de Configurações — subaba 'Dados do Usuário' (nome + troca de senha).

Cross-cutting (identidade do usuário autenticado, não uma entidade do módulo
Viabilidade) — por isso vive em app.api.routes, não em app.modules.viabilidade,
mas reaproveita `get_current_user`/`CurrentUser` de lá: é o mesmo resolvedor de
identidade a partir do JWT usado por todas as rotas do produto, não lógica de
negócio específica de Viabilidade.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from supabase_auth.errors import AuthApiError
from pydantic import BaseModel, Field, model_validator

from app.core.supabase import supabase
from app.modules.viabilidade.api.deps import CurrentUser, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _erro(status_code: int, error_code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error_code": error_code, "message": message})


class MeResponse(BaseModel):
    full_name: str
    email: str
    organization_name: str
    role: str


class MeUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    current_password: str | None = Field(default=None, min_length=1, max_length=72)
    new_password: str | None = Field(default=None, min_length=8, max_length=72)
    confirm_password: str | None = Field(default=None, min_length=8, max_length=72)

    @model_validator(mode="after")
    def _validar_troca_de_senha(self) -> "MeUpdateRequest":
        campos_senha = (self.current_password, self.new_password, self.confirm_password)
        if any(campos_senha) and not all(campos_senha):
            raise ValueError(
                "Para alterar a senha, informe senha atual, nova senha e confirmação."
            )
        if self.new_password is not None and self.new_password != self.confirm_password:
            raise ValueError("A nova senha e a confirmação não coincidem.")
        if self.full_name is None and self.new_password is None:
            raise ValueError("Informe ao menos o nome ou os dados de troca de senha.")
        return self


def _buscar_me(current_user: CurrentUser) -> MeResponse:
    profile = (
        supabase.table("profiles").select("full_name").eq("id", str(current_user.user_id)).limit(1).execute()
    )
    membro = (
        supabase.table("organization_members")
        .select("organizations(name)")
        .eq("organization_id", str(current_user.organization_id))
        .eq("user_id", str(current_user.user_id))
        .limit(1)
        .execute()
    )
    auth_user = supabase.auth.admin.get_user_by_id(str(current_user.user_id))

    full_name = profile.data[0]["full_name"] if profile.data else "Usuário"
    organizacao = (membro.data[0].get("organizations") or {}) if membro.data else {}

    return MeResponse(
        full_name=full_name,
        email=(auth_user.user.email if auth_user and auth_user.user else "") or "",
        organization_name=organizacao.get("name", "—"),
        role=current_user.role.value,
    )


@router.get("/me", response_model=MeResponse)
def obter_meu_perfil(current_user: CurrentUser = Depends(get_current_user)):
    return _buscar_me(current_user)


@router.put("/me", response_model=MeResponse)
def atualizar_meu_perfil(payload: MeUpdateRequest, current_user: CurrentUser = Depends(get_current_user)):
    if payload.full_name is not None:
        supabase.table("profiles").update({"full_name": payload.full_name}).eq(
            "id", str(current_user.user_id)
        ).execute()

    if payload.new_password is not None:
        auth_user = supabase.auth.admin.get_user_by_id(str(current_user.user_id))
        email = auth_user.user.email if auth_user and auth_user.user else None
        if not email:
            raise _erro(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "FALHA_AO_RESOLVER_USUARIO",
                "Não foi possível verificar sua conta. Tente novamente.",
            )

        # Confirma a senha atual antes de trocar — sem isso, qualquer requisição
        # autenticada (ex: sessão roubada) poderia trocar a senha sem conhecer a
        # anterior. `sign_in_with_password` é o único jeito de validar uma senha
        # em texto claro contra o Supabase Auth (o hash nunca é exposto à API).
        try:
            supabase.auth.sign_in_with_password({"email": email, "password": payload.current_password})
        except AuthApiError as exc:
            raise _erro(
                status.HTTP_403_FORBIDDEN,
                "SENHA_ATUAL_INCORRETA",
                "Senha atual incorreta.",
            ) from exc
        finally:
            # A chamada acima cria uma sessão nova no client de service role
            # compartilhado pelo processo — sem encerrá-la, requisições
            # concorrentes de outros usuários passariam a herdar essa sessão.
            try:
                supabase.auth.sign_out()
            except Exception:  # noqa: BLE001 — best-effort, não deve mascarar o resultado da troca de senha
                pass

        try:
            supabase.auth.admin.update_user_by_id(str(current_user.user_id), {"password": payload.new_password})
        except AuthApiError as exc:
            logger.error("Falha ao atualizar senha user_id=%s: %s", current_user.user_id, exc, exc_info=True)
            raise _erro(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "FALHA_AO_ATUALIZAR_SENHA",
                "Não foi possível atualizar a senha. Tente novamente.",
            ) from exc

    return _buscar_me(current_user)
