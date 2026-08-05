"""Tela 2 — Parâmetros Gerais da Versão. docs/api-spec-viabilidade.md seção 3."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from .. import repository
from ..schemas.parametros import ParametrosVersaoRequest, ParametrosVersaoResponse
from .deps import CurrentUser, get_current_user, require_owner_or_executor

router = APIRouter(prefix="/api/v1/versoes/{versao_id}/parametros", tags=["parametros"])


@router.get("", response_model=ParametrosVersaoResponse)
def obter_parametros(versao_id: UUID, current_user: CurrentUser = Depends(get_current_user)):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    registro = repository.get_parametros_versao(versao_id) or {
        "versao_id": str(versao_id),
        "aliquota_tributaria_efetiva": "0",
        "tma": None,
        "taxa_reinvestimento": None,
        "taxa_custo_captacao": None,
        "updated_at": None,
    }
    return ParametrosVersaoResponse(**registro)


@router.put("", response_model=ParametrosVersaoResponse)
def gravar_parametros(
    versao_id: UUID, payload: ParametrosVersaoRequest, current_user: CurrentUser = Depends(require_owner_or_executor)
):
    repository.get_versao_or_404(versao_id, current_user.organization_id)
    registro = repository.upsert_parametros_versao(versao_id, payload.model_dump(mode="json"))
    return ParametrosVersaoResponse(**registro)
