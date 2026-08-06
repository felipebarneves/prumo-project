import logging

from fastapi import FastAPI
from .api.routes.health import router as health_router
from .modules.viabilidade.api.router import router as viabilidade_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="Prumo API", version="0.1.0")

app.include_router(health_router)
app.include_router(viabilidade_router)


@app.get("/")
def root():
    return {"name": "Prumo API", "status": "ok"}