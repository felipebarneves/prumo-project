"""Tela 10 — Aceite de Convite. docs/prd/viabilidade/02-backend-api.md seção 11,
docs/prd/viabilidade/04-auth-integrations.md seção 2, docs/handoff/viabilidade/
tela-10-login-esqueci-senha-prumo.md seção 5.

Rotas públicas por design: quem chama ainda não tem sessão Supabase Auth nem
vínculo com nenhuma organização — o token de 128 bits do convite é o único
fator de autorização, não `Depends(get_current_user)`. Por isso este router
não importa nada de `deps.py`.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase_auth.errors import AuthApiError

from app.core.supabase import supabase
from .. import repository
from ..schemas.common import ErrorCode, OrganizationRole
from ..schemas.convites import (
    ConviteAceitarRequest,
    ConviteAceitarResponse,
    ConviteCreateRequest,
    ConviteCreateResponse,
    ConviteDetalheResponse,
)
from .deps import CurrentUser, require_owner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/convites", tags=["convites"])


def _erro(status_code: int, error_code: ErrorCode | str, message: str) -> HTTPException:
    # ErrorCode é um str-Enum: str(ErrorCode.X) resulta em "ErrorCode.X" (repr do
    # Enum), não em "X" — usar .value explicitamente para o código real da API.
    codigo = error_code.value if isinstance(error_code, ErrorCode) else str(error_code)
    return HTTPException(status_code=status_code, detail={"error_code": codigo, "message": message})


@router.post("", response_model=ConviteCreateResponse, status_code=status.HTTP_201_CREATED)
def criar_convite(payload: ConviteCreateRequest, current_user: CurrentUser = Depends(require_owner)):
    """Tela de Configurações — aba Membros e Permissões, modal '+ Convidar Membro'.
    Gate de capacidade por papel (PRD 3.1.2/3.10) — mesmo padrão de limite de
    Contratos Ativos em routes_contratos.criar_contrato."""
    capacidade = repository.get_plan_capacity(current_user.plan_tier)
    limite = capacidade["max_executors"] if payload.role == OrganizationRole.EXECUTOR else capacidade["max_viewers"]
    atuais = repository.contar_membros_por_papel(current_user.organization_id, payload.role.value)
    if atuais >= limite:
        raise _erro(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.LIMITE_PLANO_EXCEDIDO,
            "Você atingiu o limite de usuários deste papel no seu plano. Faça upgrade para convidar mais membros.",
        )

    convite = repository.criar_convite(current_user.organization_id, current_user.user_id, payload.email, payload.role.value)
    return ConviteCreateResponse(**convite)


def _buscar_convite_valido(token: UUID) -> dict:
    """Busca o convite pelo token e valida estado/expiração — usada tanto pelo
    GET (pré-visualização) quanto pelo POST (aceite), para nunca divergir os
    dois caminhos de validação."""
    convite = repository.get_convite_por_token(token)
    if convite is None:
        raise _erro(status.HTTP_404_NOT_FOUND, ErrorCode.CONVITE_NAO_ENCONTRADO, "Convite não encontrado.")

    if convite["status"] != "pendente":
        raise _erro(
            status.HTTP_409_CONFLICT,
            ErrorCode.CONVITE_JA_UTILIZADO,
            "Este convite já foi utilizado ou cancelado. Solicite um novo convite ao administrador da organização.",
        )

    expira_em = datetime.fromisoformat(convite["expires_at"])
    if expira_em <= datetime.now(timezone.utc):
        raise _erro(
            status.HTTP_410_GONE,
            ErrorCode.CONVITE_EXPIRADO,
            "Este convite expirou. Solicite um novo convite ao administrador da organização.",
        )

    return convite


@router.get("/{token}", response_model=ConviteDetalheResponse)
def obter_convite(token: UUID):
    convite = _buscar_convite_valido(token)
    organizacao = convite.get("organizations") or {}
    return ConviteDetalheResponse(
        email=convite["email"],
        role=OrganizationRole(convite["role"]),
        organization_nome=organizacao.get("name", ""),
    )


@router.post("/{token}/aceitar", response_model=ConviteAceitarResponse, status_code=status.HTTP_201_CREATED)
def aceitar_convite(token: UUID, payload: ConviteAceitarRequest):
    convite = _buscar_convite_valido(token)
    organization_id = UUID(convite["organization_id"])
    email = convite["email"]
    role = convite["role"]

    # 1) Cria o usuário no Supabase Auth. Se o e-mail já tiver conta, não
    # vinculamos automaticamente ao convite — sem verificação de posse da senha
    # atual, isso seria um vetor de account takeover (qualquer um que soubesse
    # o e-mail do convidado ganharia acesso à organização). Orientamos o
    # convidado a fazer login normalmente; reenviar convite é ação da Tela 9.
    try:
        auth_response = supabase.auth.admin.create_user(
            {
                "email": email,
                "password": payload.senha,
                "email_confirm": True,
                "user_metadata": {"full_name": payload.nome_usuario},
            }
        )
    except AuthApiError as exc:
        if exc.code == "email_exists" or exc.status == 422:
            raise _erro(
                status.HTTP_409_CONFLICT,
                ErrorCode.EMAIL_JA_CADASTRADO,
                "Já existe uma conta com este e-mail. Faça login normalmente ou peça ao administrador para reenviar o convite.",
            ) from exc
        logger.error(
            "Falha ao criar usuário no Supabase Auth para convite token=%s email=%s: code=%s status=%s message=%s",
            token, email, exc.code, exc.status, exc, exc_info=True,
        )
        raise _erro(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.FALHA_AO_ACEITAR_CONVITE,
            "Não foi possível concluir o cadastro. Tente novamente ou contate o suporte.",
        ) from exc

    user_id = UUID(auth_response.user.id)

    # 2) profiles e organization_members. Se qualquer passo daqui em diante
    # falhar, desfazemos o usuário de Auth já criado — sem isso, o convite
    # ficaria 'pendente' para sempre (o e-mail já existiria em auth.users) e o
    # convidado nunca mais conseguiria aceitar o mesmo convite.
    try:
        repository.criar_profile(user_id, payload.nome_usuario)
        repository.criar_membro_organizacao(organization_id, user_id, role)
        repository.marcar_convite_aceito(UUID(convite["id"]), user_id)
    except Exception as exc:  # noqa: BLE001 — qualquer falha aqui exige desfazer o create_user acima
        logger.error(
            "Falha ao finalizar aceite de convite token=%s user_id=%s organization_id=%s: %s",
            token, user_id, organization_id, exc, exc_info=True,
        )
        try:
            supabase.auth.admin.delete_user(str(user_id))
        except Exception as exc_rollback:  # noqa: BLE001
            logger.error(
                "Falha ao reverter usuário Auth user_id=%s após erro no aceite de convite token=%s: %s",
                user_id, token, exc_rollback, exc_info=True,
            )
        raise _erro(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.FALHA_AO_ACEITAR_CONVITE,
            "Não foi possível concluir o cadastro. Tente novamente ou contate o suporte.",
        ) from exc

    return ConviteAceitarResponse(user_id=user_id, organization_id=organization_id, role=OrganizationRole(role))
