import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes.health import router as health_router
from .modules.viabilidade.api.router import router as viabilidade_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="Prumo API", version="0.1.0")

# Sem isso, todo fetch do apps/web (origem diferente: porta 3000 vs 8000) é
# bloqueado pelo navegador antes de chegar nas rotas — mesmo com o backend
# de pé e respondendo normalmente a curl/PowerShell (que não aplicam CORS).
_allowed_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(viabilidade_router)


@app.get("/")
def root():
    return {"name": "Prumo API", "status": "ok"}