"""Testes do fluxo de Aceite de Convite (Tela 10) — Kaiser (Backend).

Cobre: token válido, token expirado, token já utilizado, e-mail duplicado.
Mesma estratégia de test_security.py — fake em memória do cliente Supabase
(incluindo `auth.admin`), sem rede nem banco real.
"""
from __future__ import annotations

import sys
import types
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException


@dataclass
class _FakeResponse:
    data: list[dict]
    count: int | None = None


class _FakeQuery:
    def __init__(self, table: "_FakeTable", mode: str, payload=None):
        self._table = table
        self._mode = mode
        self._payload = payload
        self._filters: list[tuple[str, str]] = []

    def eq(self, coluna, valor):
        self._filters.append((coluna, str(valor)))
        return self

    def limit(self, _n):
        return self

    def _linhas_correspondentes(self):
        return [
            linha
            for linha in self._table.linhas
            if all(str(linha.get(coluna)) == valor for coluna, valor in self._filters)
        ]

    def execute(self):
        if self._mode == "select":
            return _FakeResponse(data=[dict(linha) for linha in self._linhas_correspondentes()])

        if self._mode == "insert":
            registro = dict(self._payload)
            registro.setdefault("id", str(uuid.uuid4()))
            self._table.linhas.append(registro)
            return _FakeResponse(data=[registro])

        if self._mode == "update":
            linhas = self._linhas_correspondentes()
            for linha in linhas:
                linha.update(self._payload)
            return _FakeResponse(data=[dict(linha) for linha in linhas])

        raise NotImplementedError(self._mode)


class _FakeTable:
    def __init__(self):
        self.linhas: list[dict] = []

    def select(self, *_args, **_kwargs):
        return _FakeQuery(self, "select")

    def insert(self, payload):
        return _FakeQuery(self, "insert", payload)

    def update(self, payload):
        return _FakeQuery(self, "update", payload)


class _FakeUser:
    def __init__(self, user_id: str):
        self.id = user_id


class _FakeUserResponse:
    def __init__(self, user_id: str):
        self.user = _FakeUser(user_id)


class _AuthApiErrorFake(Exception):
    def __init__(self, message: str, status: int, code: str):
        super().__init__(message)
        self.status = status
        self.code = code


class _FakeAdminAuth:
    def __init__(self):
        self.emails_registrados: set[str] = set()
        self.usuarios_excluidos: list[str] = []

    def create_user(self, attrs: dict):
        from supabase_auth.errors import AuthApiError

        if attrs["email"] in self.emails_registrados:
            raise AuthApiError("Email already registered", 422, "email_exists")
        user_id = str(uuid.uuid4())
        self.emails_registrados.add(attrs["email"])
        return _FakeUserResponse(user_id)

    def delete_user(self, user_id: str):
        self.usuarios_excluidos.append(user_id)


class _FakeAuth:
    def __init__(self):
        self.admin = _FakeAdminAuth()


class _FakeSupabaseClient:
    def __init__(self):
        self._tabelas: dict[str, _FakeTable] = {}
        self.auth = _FakeAuth()

    def table(self, nome: str) -> _FakeTable:
        return self._tabelas.setdefault(nome, _FakeTable())


@pytest.fixture
def fake_supabase(monkeypatch):
    cliente = _FakeSupabaseClient()

    fake_module = types.ModuleType("app.core.supabase")
    fake_module.supabase = cliente
    monkeypatch.setitem(sys.modules, "app.core.supabase", fake_module)

    for nome_modulo in [
        "app.modules.viabilidade.repository",
        "app.modules.viabilidade.api.routes_convites",
    ]:
        sys.modules.pop(nome_modulo, None)

    # `from .. import repository` dentro de routes_convites.py resolve via
    # _handle_fromlist, que checa hasattr(pacote_pai, "repository") ANTES de
    # olhar sys.modules — sem apagar o atributo também dos pacotes pai, o
    # segundo teste em diante reaproveitaria silenciosamente o módulo
    # `repository` (e seu `supabase`) do teste anterior, mesmo já popado de
    # sys.modules acima.
    import app.modules.viabilidade as _pkg_viabilidade

    if hasattr(_pkg_viabilidade, "repository"):
        delattr(_pkg_viabilidade, "repository")
    if hasattr(_pkg_viabilidade, "api"):
        api_pkg = _pkg_viabilidade.api
        if hasattr(api_pkg, "routes_convites"):
            delattr(api_pkg, "routes_convites")

    import app.modules.viabilidade.api.routes_convites as routes_convites

    return cliente, routes_convites


@dataclass
class ConviteSeed:
    token: str
    convite_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    email: str = "convidado@empresa.com"


def _semear_convite(cliente: _FakeSupabaseClient, *, status: str = "pendente", expira_em_horas: int = 168) -> ConviteSeed:
    seed = ConviteSeed(token=str(uuid.uuid4()))
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=expira_em_horas)).isoformat()
    cliente.table("organizations").linhas.append({"id": seed.organization_id, "name": "Empresa Teste"})
    cliente.table("organization_invites").linhas.append(
        {
            "id": seed.convite_id,
            "organization_id": seed.organization_id,
            "email": seed.email,
            "role": "executor",
            "status": status,
            "token": seed.token,
            "expires_at": expires_at,
            "organizations": {"name": "Empresa Teste"},
        }
    )
    return seed


def _payload_aceite(routes_convites, senha="senha-forte-123"):
    return routes_convites.ConviteAceitarRequest(nome_usuario="Fulano", senha=senha, confirmar_senha=senha)


class TestObterConvite:
    def test_token_nao_encontrado_retorna_404(self, fake_supabase):
        _cliente, routes_convites = fake_supabase
        with pytest.raises(HTTPException) as exc:
            routes_convites.obter_convite(uuid.uuid4())
        assert exc.value.status_code == 404
        assert exc.value.detail["error_code"] == "CONVITE_NAO_ENCONTRADO"

    def test_token_valido_retorna_email_papel_e_organizacao(self, fake_supabase):
        cliente, routes_convites = fake_supabase
        seed = _semear_convite(cliente)

        resposta = routes_convites.obter_convite(uuid.UUID(seed.token))

        assert resposta.email == seed.email
        assert resposta.role.value == "executor"
        assert resposta.organization_nome == "Empresa Teste"

    def test_token_expirado_retorna_410(self, fake_supabase):
        cliente, routes_convites = fake_supabase
        seed = _semear_convite(cliente, expira_em_horas=-1)

        with pytest.raises(HTTPException) as exc:
            routes_convites.obter_convite(uuid.UUID(seed.token))
        assert exc.value.status_code == 410
        assert exc.value.detail["error_code"] == "CONVITE_EXPIRADO"

    def test_token_ja_aceito_retorna_409(self, fake_supabase):
        cliente, routes_convites = fake_supabase
        seed = _semear_convite(cliente, status="aceito")

        with pytest.raises(HTTPException) as exc:
            routes_convites.obter_convite(uuid.UUID(seed.token))
        assert exc.value.status_code == 409
        assert exc.value.detail["error_code"] == "CONVITE_JA_UTILIZADO"


class TestAceitarConvite:
    def test_aceite_valido_cria_profile_membro_e_marca_convite_aceito(self, fake_supabase):
        cliente, routes_convites = fake_supabase
        seed = _semear_convite(cliente)

        resposta = routes_convites.aceitar_convite(uuid.UUID(seed.token), _payload_aceite(routes_convites))

        assert str(resposta.organization_id) == seed.organization_id
        assert resposta.role.value == "executor"

        profiles = cliente.table("profiles").linhas
        assert len(profiles) == 1
        assert profiles[0]["id"] == str(resposta.user_id)

        membros = cliente.table("organization_members").linhas
        assert len(membros) == 1
        assert membros[0]["organization_id"] == seed.organization_id
        assert membros[0]["role"] == "executor"

        convite_atualizado = cliente.table("organization_invites").linhas[0]
        assert convite_atualizado["status"] == "aceito"
        assert convite_atualizado["accepted_by"] == str(resposta.user_id)

    def test_email_ja_cadastrado_retorna_409_sem_criar_membro(self, fake_supabase):
        cliente, routes_convites = fake_supabase
        seed = _semear_convite(cliente)
        cliente.auth.admin.emails_registrados.add(seed.email)

        with pytest.raises(HTTPException) as exc:
            routes_convites.aceitar_convite(uuid.UUID(seed.token), _payload_aceite(routes_convites))

        assert exc.value.status_code == 409
        assert exc.value.detail["error_code"] == "EMAIL_JA_CADASTRADO"
        assert cliente.table("organization_members").linhas == []
        assert cliente.table("organization_invites").linhas[0]["status"] == "pendente"

    def test_token_expirado_bloqueia_aceite(self, fake_supabase):
        cliente, routes_convites = fake_supabase
        seed = _semear_convite(cliente, expira_em_horas=-1)

        with pytest.raises(HTTPException) as exc:
            routes_convites.aceitar_convite(uuid.UUID(seed.token), _payload_aceite(routes_convites))
        assert exc.value.status_code == 410
        assert exc.value.detail["error_code"] == "CONVITE_EXPIRADO"

    def test_token_ja_aceito_bloqueia_reaceite(self, fake_supabase):
        cliente, routes_convites = fake_supabase
        seed = _semear_convite(cliente, status="aceito")

        with pytest.raises(HTTPException) as exc:
            routes_convites.aceitar_convite(uuid.UUID(seed.token), _payload_aceite(routes_convites))
        assert exc.value.status_code == 409
        assert exc.value.detail["error_code"] == "CONVITE_JA_UTILIZADO"

    def test_senhas_diferentes_falha_na_validacao_do_schema(self, fake_supabase):
        _cliente, routes_convites = fake_supabase
        with pytest.raises(Exception):
            routes_convites.ConviteAceitarRequest(nome_usuario="Fulano", senha="senha-forte-123", confirmar_senha="outra-senha")
