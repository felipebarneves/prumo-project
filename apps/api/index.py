"""Entrypoint de deploy para a Vercel Python Runtime (@vercel/python).

A Vercel detecta e serve automaticamente uma aplicação ASGI/WSGI exposta pela
variável `app` neste módulo. Mantido separado de `app/main.py` para que o
código de aplicação não precise saber nada sobre a plataforma de deploy —
Pulse (infra) é o único dono deste arquivo.
"""
import sys
from pathlib import Path

# O build do vercel.json (Opção B) empacota a partir da raiz do monorepo, então
# o cwd em runtime não inclui apps/api/ — sem isso, "from app.main import app"
# falha com ModuleNotFoundError: No module named 'app' (confirmado em produção,
# apps/api/app/ nunca é encontrado porque só apps/api/ estaria no sys.path, não
# a raiz deste arquivo).
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.main import app  # noqa: E402, F401
