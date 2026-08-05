"""Testes de segurança/isolamento entre tenants — Sentinel (QA).

Cobrem os casos de BOLA/IDOR encontrados na auditoria (docs/qa-report-viabilidade.md):
um usuário Owner/Executor da Organização A não pode ler, alterar ou excluir recursos
(despesas não operacionais, snapshots) pertencentes à Organização B, mesmo conhecendo
o UUID do recurso. Como o backend usa a service role key do Supabase (contorna RLS —
ver repository.py), essas checagens de propriedade DEVEM existir na camada de
aplicação: RLS por si só não protegeria esta API.

Estratégia: exercitar repository.py diretamente contra um fake em memória do cliente
Supabase (duas organizações, cada uma com seu contrato/versão/despesa/snapshot),
comprovando que uma consulta escopada pela organização/versão errada nunca retorna
nem afeta o recurso da outra organização.
"""
from __future__ import annotations

import sys
import types
import uuid
from dataclasses import dataclass, field

import pytest


# -----------------------------------------------------------------------------
# Fake mínimo do cliente Supabase (postgrest-py) — suficiente para exercitar os
# filtros .eq()/.limit()/.execute() usados por repository.py, sem precisar de
# um banco Postgres real nem de rede.
# -----------------------------------------------------------------------------


@dataclass
class _FakeResponse:
    data: list[dict]
    count: int | None = None


class _FakeQuery:
    def __init__(self, table: "_FakeTable", mode: str, payload=None):
        self._table = table
        self._mode = mode
        self._payload = payload
        self._filters: list[tuple[str, object]] = []
        self._is_null_filters: list[str] = []
        self._join_filters: list[tuple[str, str, str]] = []

    def eq(self, coluna, valor):
        if "." in coluna:
            # Suporte mínimo ao padrão usado por repository.get_versao_or_404:
            # select("*, contratos!inner(organization_id)").eq("contratos.organization_id", ...)
            # — resolve via FK contrato_id na própria linha, não via join real.
            tabela_relacionada, coluna_relacionada = coluna.split(".", 1)
            self._join_filters.append((tabela_relacionada, coluna_relacionada, str(valor)))
        else:
            self._filters.append((coluna, str(valor)))
        return self

    def is_(self, coluna, valor):
        if valor == "null":
            self._is_null_filters.append(coluna)
        return self

    def limit(self, _n):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def range(self, *_args, **_kwargs):
        return self

    def or_(self, *_args, **_kwargs):
        return self

    def _linhas_correspondentes(self):
        linhas = self._table.linhas
        for coluna, valor in self._filters:
            linhas = [linha for linha in linhas if str(linha.get(coluna)) == valor]
        for coluna in self._is_null_filters:
            linhas = [linha for linha in linhas if linha.get(coluna) is None]
        for tabela_relacionada, coluna_relacionada, valor in self._join_filters:
            tabela_fk = self._table._client.table(tabela_relacionada)
            fk_local = "contrato_id" if tabela_relacionada == "contratos" else f"{tabela_relacionada[:-1]}_id"

            def _bate(linha, tabela_fk=tabela_fk, fk_local=fk_local, coluna_relacionada=coluna_relacionada, valor=valor):
                relacionada = next((r for r in tabela_fk.linhas if str(r.get("id")) == str(linha.get(fk_local))), None)
                return relacionada is not None and str(relacionada.get(coluna_relacionada)) == valor

            linhas = [linha for linha in linhas if _bate(linha)]
        return linhas

    def execute(self):
        if self._mode == "select":
            linhas = self._linhas_correspondentes()
            return _FakeResponse(data=[dict(linha) for linha in linhas], count=len(linhas))

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

        if self._mode == "delete":
            linhas = self._linhas_correspondentes()
            ids_remover = {id(linha) for linha in linhas}
            self._table.linhas = [linha for linha in self._table.linhas if id(linha) not in ids_remover]
            return _FakeResponse(data=[dict(linha) for linha in linhas])

        raise NotImplementedError(self._mode)


class _FakeTable:
    def __init__(self, client: "_FakeSupabaseClient"):
        self.linhas: list[dict] = []
        self._client = client

    def select(self, *_args, **_kwargs):
        return _FakeQuery(self, "select")

    def insert(self, payload):
        return _FakeQuery(self, "insert", payload)

    def update(self, payload):
        return _FakeQuery(self, "update", payload)

    def delete(self):
        return _FakeQuery(self, "delete")

    def upsert(self, payload, on_conflict=None):  # noqa: ARG002
        return _FakeQuery(self, "insert", payload)


class _FakeSupabaseClient:
    def __init__(self):
        self._tabelas: dict[str, _FakeTable] = {}

    def table(self, nome: str) -> _FakeTable:
        return self._tabelas.setdefault(nome, _FakeTable(self))


@pytest.fixture
def fake_supabase(monkeypatch):
    """Substitui app.core.supabase.supabase por um cliente fake, e faz repository.py
    (que importa `from app.core.supabase import supabase` no escopo do módulo) usar
    o fake — sem precisar de credenciais reais nem rede."""
    cliente = _FakeSupabaseClient()

    fake_module = types.ModuleType("app.core.supabase")
    fake_module.supabase = cliente
    monkeypatch.setitem(sys.modules, "app.core.supabase", fake_module)

    # repository.py já pode ter sido importado por outro teste com o supabase real
    # (ou ausente); forçar reimport para capturar o fake no `from ... import supabase`.
    for nome_modulo in [
        "app.modules.viabilidade.repository",
        "app.modules.viabilidade.mapping",
    ]:
        sys.modules.pop(nome_modulo, None)

    import app.modules.viabilidade.repository as repository

    return cliente, repository


@dataclass
class Tenant:
    organization_id: str
    contrato_id: str
    versao_id: str
    despesa_id: str
    snapshot_id: str
    user_id: str = field(default_factory=lambda: str(uuid.uuid4()))


def _semear_tenant(cliente: _FakeSupabaseClient) -> Tenant:
    organization_id = str(uuid.uuid4())
    contrato_id = str(uuid.uuid4())
    versao_id = str(uuid.uuid4())
    despesa_id = str(uuid.uuid4())
    snapshot_id = str(uuid.uuid4())

    cliente.table("contratos").linhas.append(
        {"id": contrato_id, "organization_id": organization_id, "duracao_meses": 12, "arquivado_em": None}
    )
    cliente.table("versoes").linhas.append({"id": versao_id, "contrato_id": contrato_id, "nome_versao": "V1"})
    cliente.table("despesas_nao_operacionais").linhas.append(
        {"id": despesa_id, "versao_id": versao_id, "descricao": "Original", "tipo": "despesa", "percentual": "0.1"}
    )
    cliente.table("versao_snapshots").linhas.append(
        {"id": snapshot_id, "contrato_id": contrato_id, "nome": "Snapshot original", "tipo": "comparacao"}
    )

    return Tenant(organization_id, contrato_id, versao_id, despesa_id, snapshot_id)


class TestIsolamentoDeDespesasNaoOperacionais:
    """PRD 5.1 — nenhuma regra crítica de autorização depende do frontend; o
    backend deve escopar toda escrita por tenant, mesmo usando a service role key."""

    def test_get_despesa_or_404_rejeita_versao_de_outra_organizacao(self, fake_supabase):
        cliente, repository = fake_supabase
        org_a = _semear_tenant(cliente)
        org_b = _semear_tenant(cliente)

        # Tenant B tenta acessar a despesa do Tenant A informando a própria versao_id.
        with pytest.raises(Exception):
            repository.get_despesa_or_404(uuid.UUID(org_a.despesa_id), uuid.UUID(org_b.versao_id))

    def test_atualizar_despesa_nao_altera_registro_de_outra_organizacao(self, fake_supabase):
        cliente, repository = fake_supabase
        org_a = _semear_tenant(cliente)
        org_b = _semear_tenant(cliente)

        with pytest.raises(Exception):
            repository.atualizar_despesa(
                uuid.UUID(org_a.despesa_id), uuid.UUID(org_b.versao_id), {"descricao": "Sequestrada pelo Tenant B"}
            )

        despesa_persistida = cliente.table("despesas_nao_operacionais").linhas[0]
        assert despesa_persistida["id"] == org_a.despesa_id
        assert despesa_persistida["descricao"] == "Original"

    def test_excluir_despesa_nao_remove_registro_de_outra_organizacao(self, fake_supabase):
        cliente, repository = fake_supabase
        org_a = _semear_tenant(cliente)
        org_b = _semear_tenant(cliente)

        with pytest.raises(Exception):
            repository.excluir_despesa(uuid.UUID(org_a.despesa_id), uuid.UUID(org_b.versao_id))

        ids_restantes = {linha["id"] for linha in cliente.table("despesas_nao_operacionais").linhas}
        assert org_a.despesa_id in ids_restantes

    def test_atualizar_despesa_funciona_normalmente_dentro_do_proprio_tenant(self, fake_supabase):
        cliente, repository = fake_supabase
        org_a = _semear_tenant(cliente)

        atualizada = repository.atualizar_despesa(
            uuid.UUID(org_a.despesa_id), uuid.UUID(org_a.versao_id), {"descricao": "Atualizada legitimamente"}
        )
        assert atualizada["descricao"] == "Atualizada legitimamente"


class TestIsolamentoDeSnapshots:
    def test_get_snapshot_or_404_rejeita_contrato_de_outra_organizacao(self, fake_supabase):
        cliente, repository = fake_supabase
        org_a = _semear_tenant(cliente)
        org_b = _semear_tenant(cliente)

        with pytest.raises(Exception):
            repository.get_snapshot_or_404(uuid.UUID(org_a.snapshot_id), uuid.UUID(org_b.contrato_id))

    def test_excluir_snapshot_nao_remove_registro_de_outra_organizacao(self, fake_supabase):
        cliente, repository = fake_supabase
        org_a = _semear_tenant(cliente)
        org_b = _semear_tenant(cliente)

        with pytest.raises(Exception):
            repository.excluir_snapshot(uuid.UUID(org_a.snapshot_id), uuid.UUID(org_b.contrato_id))

        ids_restantes = {linha["id"] for linha in cliente.table("versao_snapshots").linhas}
        assert org_a.snapshot_id in ids_restantes

    def test_excluir_snapshot_funciona_normalmente_dentro_do_proprio_tenant(self, fake_supabase):
        cliente, repository = fake_supabase
        org_a = _semear_tenant(cliente)

        repository.excluir_snapshot(uuid.UUID(org_a.snapshot_id), uuid.UUID(org_a.contrato_id))

        ids_restantes = {linha["id"] for linha in cliente.table("versao_snapshots").linhas}
        assert org_a.snapshot_id not in ids_restantes


class TestConsistenciaVersaoContrato:
    """routes_versoes.py — confused-deputy: contrato_id do path precisa bater com o
    contrato_id real da versão, mesmo quando ambos pertencem à mesma organização."""

    def test_get_versao_or_404_nao_valida_contrato_sozinho(self, fake_supabase):
        """Documenta a premissa: get_versao_or_404 só garante organização, não
        contrato — a checagem de contrato é responsabilidade da rota
        (_validar_versao_pertence_ao_contrato em routes_versoes.py)."""
        cliente, repository = fake_supabase
        tenant = _semear_tenant(cliente)

        outro_contrato_id = str(uuid.uuid4())
        cliente.table("contratos").linhas.append(
            {"id": outro_contrato_id, "organization_id": tenant.organization_id, "duracao_meses": 6, "arquivado_em": None}
        )

        # versao pertence a tenant.contrato_id, não a outro_contrato_id — mas
        # get_versao_or_404 é escopado apenas por organização, então "encontra"
        # a versão normalmente. A rota é quem deve rejeitar o descasamento.
        versao = repository.get_versao_or_404(uuid.UUID(tenant.versao_id), uuid.UUID(tenant.organization_id))
        assert str(versao["contrato_id"]) != outro_contrato_id
