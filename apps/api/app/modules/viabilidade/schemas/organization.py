"""Tela de Configurações — Dados da Organização, Membros e Assinatura/Plano."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from .common import OrganizationRole, PlanTier, SubscriptionStatus


class OrganizationSettingsResponse(BaseModel):
    id: UUID
    name: str
    document_id: str | None
    plan_tier: PlanTier
    subscription_status: SubscriptionStatus
    created_at: datetime


class OrganizationSettingsUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    document_id: str | None = Field(default=None, max_length=32)


class OrganizationMemberItem(BaseModel):
    id: UUID
    user_id: UUID
    full_name: str
    email: str | None
    role: OrganizationRole
    created_at: datetime


class OrganizationMembersResponse(BaseModel):
    items: list[OrganizationMemberItem]
    total: int


class PlanCapacity(BaseModel):
    max_executors: int
    max_viewers: int
    max_active_contracts: int


class PlanUsage(BaseModel):
    executors: int
    viewers: int
    active_contracts: int


class OrganizationSubscriptionResponse(BaseModel):
    plan_tier: PlanTier
    subscription_status: SubscriptionStatus
    capacity: PlanCapacity
    usage: PlanUsage
