"""Entrypoint de deploy para a Vercel Python Runtime (@vercel/python).

A Vercel detecta e serve automaticamente uma aplicação ASGI/WSGI exposta pela
variável `app` neste módulo. Mantido separado de `app/main.py` para que o
código de aplicação não precise saber nada sobre a plataforma de deploy —
Pulse (infra) é o único dono deste arquivo.
"""
from app.main import app  # noqa: F401
