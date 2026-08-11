"""Tela de Configurações — Dados da Organização, Membros e Permissões, Assinatura e Plano."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from app.core.supabase import supabase
from .. import repository
from ..schemas.organization import (
    OrganizationMemberItem,
    OrganizationMembersResponse,
    OrganizationSettingsResponse,
    OrganizationSettingsUpdateRequest,
    OrganizationSubscriptionResponse,
    PlanCapacity,
    PlanUsage,
)
from .deps import CurrentUser, get_current_user, require_owner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/organization", tags=["organization"])


@router.get("/settings", response_model=OrganizationSettingsResponse)
def obter_configuracoes(current_user: CurrentUser = Depends(get_current_user)):
    organizacao = repository.get_organizacao_or_404(current_user.organization_id)
    return OrganizationSettingsResponse(**organizacao)


@router.put("/settings", response_model=OrganizationSettingsResponse)
def atualizar_configuracoes(
    payload: OrganizationSettingsUpdateRequest, current_user: CurrentUser = Depends(require_owner)
):
    dados = payload.model_dump(mode="json")
    organizacao = repository.atualizar_organizacao(current_user.organization_id, dados)
    return OrganizationSettingsResponse(**organizacao)


def _email_do_usuario(user_id: str) -> str | None:
    """Resolve o e-mail via Supabase Auth Admin — não existe coluna de e-mail em
    `profiles` (o e-mail vive só em `auth.users`, fora do alcance do PostgREST)."""
    try:
        resposta = supabase.auth.admin.get_user_by_id(user_id)
        return resposta.user.email if resposta and resposta.user else None
    except Exception as exc:  # noqa: BLE001 — falha pontual não deve derrubar a listagem inteira
        logger.warning("Falha ao resolver e-mail do usuário user_id=%s: %s", user_id, exc)
        return None


@router.get("/members", response_model=OrganizationMembersResponse)
def listar_membros(current_user: CurrentUser = Depends(get_current_user)):
    membros = repository.listar_membros_organizacao(current_user.organization_id)
    itens = [
        OrganizationMemberItem(
            id=membro["id"],
            user_id=membro["user_id"],
            full_name=(membro.get("profiles") or {}).get("full_name", "—"),
            email=_email_do_usuario(membro["user_id"]),
            role=membro["role"],
            created_at=membro["created_at"],
        )
        for membro in membros
    ]
    return OrganizationMembersResponse(items=itens, total=len(itens))


@router.get("/subscription", response_model=OrganizationSubscriptionResponse)
def obter_assinatura(current_user: CurrentUser = Depends(get_current_user)):
    organizacao = repository.get_organizacao_or_404(current_user.organization_id)
    capacidade = repository.get_plan_capacity(current_user.plan_tier)

    return OrganizationSubscriptionResponse(
        plan_tier=organizacao["plan_tier"],
        subscription_status=organizacao.get("subscription_status", "inactive"),
        capacity=PlanCapacity(
            max_executors=capacidade["max_executors"],
            max_viewers=capacidade["max_viewers"],
            max_active_contracts=capacidade["max_active_contracts"],
        ),
        usage=PlanUsage(
            executors=repository.contar_membros_por_papel(current_user.organization_id, "executor"),
            viewers=repository.contar_membros_por_papel(current_user.organization_id, "viewer"),
            active_contracts=repository.contar_contratos_ativos(current_user.organization_id),
        ),
    )
