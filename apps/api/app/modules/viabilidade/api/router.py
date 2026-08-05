"""Router agregador do módulo Viabilidade — incluído em app.main."""
from __future__ import annotations

from fastapi import APIRouter

from . import (
    routes_contratos,
    routes_cronograma,
    routes_dashboard,
    routes_despesas,
    routes_dre,
    routes_fluxo_caixa,
    routes_linhas,
    routes_parametros,
    routes_versoes,
)

router = APIRouter()

router.include_router(routes_contratos.router)
router.include_router(routes_versoes.router)
router.include_router(routes_parametros.router)
router.include_router(routes_linhas.router)
router.include_router(routes_despesas.router)
router.include_router(routes_cronograma.router)
router.include_router(routes_dre.router)
router.include_router(routes_fluxo_caixa.router)
router.include_router(routes_dashboard.router)
