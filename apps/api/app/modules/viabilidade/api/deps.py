"""Dependências de autenticação e autorização — injetadas em todas as rotas do módulo.

RLS no Supabase garante isolamento de tenant e a matriz de papéis na camada de banco
(supabase/migrations/00003_viabilidade_schema.sql). Estas dependências resolvem a
identidade do usuário a partir do JWT e expõem helpers de autorização usados nas rotas
para os casos de negócio que RLS não cobre (ex: gate por subscription_status, limites
de plano) — consistente com PRD 5.1: nenhuma regra crítica depende do frontend.
"""
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status

from app.core.supabase import supabase
from ..schemas.common import ErrorCode, OrganizationRole, SubscriptionStatus


@dataclass(frozen=True)
class CurrentUser:
    user_id: UUID
    organization_id: UUID
    role: OrganizationRole
    subscription_status: SubscriptionStatus
    plan_tier: str


def _erro(status_code: int, error_code: ErrorCode | str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error_code": str(error_code), "message": message})


async def get_current_user(authorization: str = Header(default="")) -> CurrentUser:
    """Resolve o usuário autenticado a partir do JWT do Supabase Auth (Bearer token).

    A verificação criptográfica do JWT e o isolamento de tenant são responsabilidade
    do Supabase (Auth + RLS); esta dependência apenas traduz o token em contexto de
    autorização de negócio consumido pelas rotas.
    """
    if not authorization.startswith("Bearer "):
        raise _erro(status.HTTP_401_UNAUTHORIZED, "TOKEN_AUSENTE", "Token de autenticação ausente ou inválido.")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        auth_response = supabase.auth.get_user(token)
    except Exception as exc:  # noqa: BLE001 — erro de rede/token do SDK do Supabase
        raise _erro(status.HTTP_401_UNAUTHORIZED, "TOKEN_INVALIDO", "Sessão expirada ou inválida.") from exc

    if auth_response is None or auth_response.user is None:
        raise _erro(status.HTTP_401_UNAUTHORIZED, "TOKEN_INVALIDO", "Sessão expirada ou inválida.")

    user_id = auth_response.user.id

    membro = (
        supabase.table("organization_members")
        .select("organization_id, role, organizations(plan_tier, subscription_status)")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not membro.data:
        raise _erro(status.HTTP_403_FORBIDDEN, "SEM_ORGANIZACAO", "Usuário não pertence a nenhuma organização.")

    registro = membro.data[0]
    organizacao = registro.get("organizations") or {}

    return CurrentUser(
        user_id=UUID(user_id),
        organization_id=UUID(registro["organization_id"]),
        role=OrganizationRole(registro["role"]),
        subscription_status=SubscriptionStatus(organizacao.get("subscription_status", "inactive")),
        plan_tier=organizacao.get("plan_tier", "starter"),
    )


def require_write_access(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Gate de escrita transversal (docs/api-spec-viabilidade.md seção 1).

    active     -> libera conforme papel (verificação fina de papel fica em require_roles)
    past_due   -> bloqueia toda escrita
    inactive   -> bloqueia toda escrita
    """
    if current_user.subscription_status != SubscriptionStatus.ACTIVE:
        raise _erro(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.ASSINATURA_BLOQUEIA_ESCRITA,
            "Sua assinatura não permite esta ação no momento. Regularize o pagamento para liberar a escrita.",
        )
    return current_user


def require_roles(*papeis_permitidos: OrganizationRole):
    """Fábrica de dependência — reforça no backend a matriz de permissão do PRD (seção 3.1.6),
    independentemente da política RLS aplicada na mesma requisição."""

    def _checar(current_user: CurrentUser = Depends(require_write_access)) -> CurrentUser:
        if current_user.role not in papeis_permitidos:
            raise _erro(
                status.HTTP_403_FORBIDDEN,
                "PAPEL_SEM_PERMISSAO",
                "Seu papel na organização não permite executar esta ação.",
            )
        return current_user

    return _checar


require_owner_or_executor = require_roles(OrganizationRole.OWNER, OrganizationRole.EXECUTOR)
require_owner = require_roles(OrganizationRole.OWNER)
