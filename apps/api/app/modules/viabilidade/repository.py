"""Acesso a dados do módulo Viabilidade via cliente Supabase (service role).

Importante: `app.core.supabase.supabase` é inicializado com a SERVICE ROLE KEY
(ver apps/api/app/core/supabase.py), que **contorna RLS**. Isso é necessário para
que o backend possa aplicar as regras de negócio que RLS não expressa (limites de
plano, gate de subscription_status, bloqueios por origem/override) antes de decidir
se a escrita é permitida — mas também significa que todo filtro por `organization_id`
precisa ser aplicado explicitamente aqui, nunca assumido como garantido pelo banco.

Este módulo não implementa lógica de negócio — apenas tradução entre as tabelas
criadas pela migration do Atlas (supabase/migrations/00003_viabilidade_schema.sql)
e dicionários simples consumidos pelas rotas.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from postgrest import APIError as PostgrestAPIError

from app.core.supabase import supabase

logger = logging.getLogger(__name__)


def _escapar_valor_postgrest(valor: str) -> str:
    """Escapa vírgula, parênteses e barra invertida antes de interpolar um valor
    de usuário dentro de uma string de filtro `or_`/`ilike` do PostgREST."""
    return valor.replace("\\", "\\\\").replace(",", "\\,").replace("(", "\\(").replace(")", "\\)")


def _not_found(entidade: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"error_code": "NAO_ENCONTRADO", "message": f"{entidade} não encontrado."})


# --------------------------------------------------------------------------- estrutura comercial

def get_plan_capacity(tier: str) -> dict[str, Any]:
    resp = supabase.table("plan_capacities").select("*").eq("tier", tier).limit(1).execute()
    return resp.data[0]


def contar_membros_por_papel(organization_id: UUID, role: str) -> int:
    resp = (
        supabase.table("organization_members")
        .select("id", count="exact")
        .eq("organization_id", str(organization_id))
        .eq("role", role)
        .execute()
    )
    return resp.count or 0


def get_organizacao_or_404(organization_id: UUID) -> dict[str, Any]:
    resp = supabase.table("organizations").select("*").eq("id", str(organization_id)).limit(1).execute()
    if not resp.data:
        raise _not_found("Organização")
    return resp.data[0]


def atualizar_organizacao(organization_id: UUID, dados: dict[str, Any]) -> dict[str, Any]:
    resp = (
        supabase.table("organizations")
        .update(dados)
        .eq("id", str(organization_id))
        .execute()
    )
    if not resp.data:
        raise _not_found("Organização")
    return resp.data[0]


def listar_membros_organizacao(organization_id: UUID) -> list[dict[str, Any]]:
    resp = (
        supabase.table("organization_members")
        .select("id, user_id, role, created_at, profiles(full_name)")
        .eq("organization_id", str(organization_id))
        .order("created_at", desc=False)
        .execute()
    )
    return resp.data or []


# --------------------------------------------------------------------------- contratos

def get_contrato_or_404(contrato_id: UUID, organization_id: UUID) -> dict[str, Any]:
    resp = (
        supabase.table("contratos")
        .select("*")
        .eq("id", str(contrato_id))
        .eq("organization_id", str(organization_id))
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise _not_found("Contrato")
    return resp.data[0]


def contar_contratos_ativos(organization_id: UUID) -> int:
    resp = (
        supabase.table("contratos")
        .select("id", count="exact")
        .eq("organization_id", str(organization_id))
        .is_("arquivado_em", "null")
        .execute()
    )
    return resp.count or 0


def criar_contrato(organization_id: UUID, created_by: UUID, dados: dict[str, Any]) -> dict[str, Any]:
    if not organization_id or not created_by:
        # Falha explícita em vez de deixar o Postgres rejeitar por FK/NOT NULL
        # (org_id ausente é o sintoma mais comum de bug em get_current_user/deps.py,
        # não da gravação em si — melhor expor isso já aqui, com contexto).
        logger.error(
            "criar_contrato chamado sem organization_id/created_by válidos "
            "(organization_id=%s, created_by=%s) — payload=%s",
            organization_id, created_by, dados,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "ORGANIZATION_ID_AUSENTE",
                "message": "Não foi possível determinar a organização do usuário autenticado.",
            },
        )

    payload = {**dados, "organization_id": str(organization_id), "created_by": str(created_by)}
    try:
        resp = supabase.table("contratos").insert(payload).execute()
    except PostgrestAPIError as exc:
        # Loga a mensagem exata do PostgREST/Postgres (ex: violação de FK em
        # organization_id, violação de RLS se a service role key estiver mal
        # configurada, CHECK constraint) antes de traduzir para um 500 genérico
        # ao cliente — sem isso, a causa raiz nunca aparece em lugar nenhum.
        logger.error(
            "Falha ao inserir em 'contratos' para organization_id=%s created_by=%s: "
            "code=%s message=%s details=%s hint=%s payload=%s",
            organization_id, created_by, exc.code, exc.message, exc.details, exc.hint, payload,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "FALHA_AO_CRIAR_CONTRATO",
                "message": "Não foi possível criar o projeto. Tente novamente ou contate o suporte.",
            },
        ) from exc

    if not resp.data:
        logger.error(
            "Insert em 'contratos' retornou sem dados (organization_id=%s created_by=%s payload=%s) — "
            "possível política RLS bloqueando o SELECT de retorno do INSERT.",
            organization_id, created_by, payload,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "FALHA_AO_CRIAR_CONTRATO",
                "message": "O projeto pode não ter sido criado corretamente. Verifique antes de tentar novamente.",
            },
        )

    return resp.data[0]


def atualizar_contrato(contrato_id: UUID, organization_id: UUID, dados: dict[str, Any]) -> dict[str, Any]:
    get_contrato_or_404(contrato_id, organization_id)
    resp = supabase.table("contratos").update(dados).eq("id", str(contrato_id)).execute()
    return resp.data[0]


def listar_contratos(organization_id: UUID, filtros: dict[str, Any], page: int, page_size: int) -> tuple[list[dict], int]:
    query = supabase.table("contratos").select("*", count="exact").eq("organization_id", str(organization_id))
    if not filtros.get("mostrar_arquivados"):
        query = query.is_("arquivado_em", "null")
    if filtros.get("status_ciclo_vida"):
        query = query.eq("status_ciclo_vida", filtros["status_ciclo_vida"])
    if filtros.get("busca"):
        # Escapa metacaracteres de sintaxe do PostgREST (`,`, `(`, `)`) antes de
        # interpolar a busca livre do usuário na string de filtro `or_` — sem isso,
        # um termo como "x,status_ciclo_vida.eq.cancelado" poderia adicionar uma
        # condição OR arbitrária à consulta (filter injection). A varredura por
        # organização continua sendo outra cláusula .eq() encadeada (AND), então o
        # isolamento de tenant nunca depende deste filtro — mas a lógica de busca
        # em si pode ser manipulada sem o escape.
        termo = _escapar_valor_postgrest(filtros["busca"])
        query = query.or_(f"nome_projeto.ilike.%{termo}%,cliente.ilike.%{termo}%")
    inicio = (page - 1) * page_size
    try:
        resp = query.range(inicio, inicio + page_size - 1).execute()
    except PostgrestAPIError as exc:
        logger.error(
            "Falha ao listar 'contratos' para organization_id=%s filtros=%s page=%s page_size=%s: "
            "code=%s message=%s details=%s hint=%s",
            organization_id, filtros, page, page_size, exc.code, exc.message, exc.details, exc.hint,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "FALHA_AO_LISTAR_CONTRATOS",
                "message": "Não foi possível carregar os projetos. Tente novamente.",
            },
        ) from exc

    # resp.data pode vir None (não apenas []) quando a organização não tem
    # nenhum contrato ainda (usuário novo) — sem o `or []` aqui, o `for item in itens`
    # da rota estoura TypeError e a listagem retorna 500 em vez de 200 com [].
    return resp.data or [], resp.count or 0


def listar_vinculos_modulo(contrato_id: UUID) -> list[dict[str, Any]]:
    resp = (
        supabase.table("contrato_modulo_vinculos")
        .select("*")
        .eq("contrato_id", str(contrato_id))
        .is_("desvinculado_em", "null")
        .execute()
    )
    return resp.data


def criar_vinculo_modulo(contrato_id: UUID, created_by: UUID, modulo: str, contrato_origem_id: UUID) -> dict[str, Any]:
    payload = {
        "contrato_id": str(contrato_id),
        "modulo": modulo,
        "contrato_origem_id": str(contrato_origem_id),
        "created_by": str(created_by),
    }
    resp = supabase.table("contrato_modulo_vinculos").insert(payload).execute()
    return resp.data[0]


def desvincular_modulo(contrato_id: UUID, modulo: str) -> None:
    supabase.table("contrato_modulo_vinculos").update({"desvinculado_em": "now()"}).eq(
        "contrato_id", str(contrato_id)
    ).eq("modulo", modulo).execute()


# --------------------------------------------------------------------------- versões

def get_versao_or_404(versao_id: UUID, organization_id: UUID) -> dict[str, Any]:
    resp = (
        supabase.table("versoes")
        .select("*, contratos!inner(organization_id)")
        .eq("id", str(versao_id))
        .eq("contratos.organization_id", str(organization_id))
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise _not_found("Versão")
    return resp.data[0]


def listar_versoes(contrato_id: UUID) -> list[dict[str, Any]]:
    resp = (
        supabase.table("versoes")
        .select("*")
        .eq("contrato_id", str(contrato_id))
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data


def contar_versoes(contrato_id: UUID) -> int:
    resp = supabase.table("versoes").select("id", count="exact").eq("contrato_id", str(contrato_id)).execute()
    return resp.count or 0


def criar_versao(contrato_id: UUID, created_by: UUID, nome_versao: str, origem_versao_id: UUID | None) -> dict[str, Any]:
    payload = {
        "contrato_id": str(contrato_id),
        "nome_versao": nome_versao,
        "created_by": str(created_by),
        "origem_versao_id": str(origem_versao_id) if origem_versao_id else None,
    }
    resp = supabase.table("versoes").insert(payload).execute()
    nova_versao = resp.data[0]

    if origem_versao_id:
        _duplicar_dados_versao(origem_versao_id, nova_versao["id"])

    return nova_versao


def _duplicar_dados_versao(origem_id: UUID, destino_id: UUID) -> None:
    """Cópia completa das Telas 2-5 (PRD 3.8) — parâmetros, linhas, distribuição e despesas."""
    parametros = supabase.table("parametros_versao").select("*").eq("versao_id", str(origem_id)).limit(1).execute()
    if parametros.data:
        p = {**parametros.data[0], "versao_id": str(destino_id)}
        p.pop("updated_at", None)
        supabase.table("parametros_versao").insert(p).execute()

    for tabela, tabela_dist, fk_dist in [
        ("linhas_receita", "distribuicao_receita", "linha_receita_id"),
        ("linhas_custo", "distribuicao_custo", "linha_custo_id"),
    ]:
        linhas = supabase.table(tabela).select("*").eq("versao_id", str(origem_id)).execute().data
        for linha in linhas:
            linha_id_antiga = linha["id"]
            nova_linha = {k: v for k, v in linha.items() if k not in ("id", "created_at", "updated_at")}
            nova_linha["versao_id"] = str(destino_id)
            nova = supabase.table(tabela).insert(nova_linha).execute().data[0]

            distribuicoes = supabase.table(tabela_dist).select("*").eq(fk_dist, linha_id_antiga).execute().data
            for celula in distribuicoes:
                nova_celula = {k: v for k, v in celula.items() if k not in ("id", "updated_at")}
                nova_celula[fk_dist] = nova["id"]
                supabase.table(tabela_dist).insert(nova_celula).execute()

    despesas = supabase.table("despesas_nao_operacionais").select("*").eq("versao_id", str(origem_id)).execute().data
    for despesa in despesas:
        nova_despesa = {k: v for k, v in despesa.items() if k not in ("id", "created_at", "updated_at")}
        nova_despesa["versao_id"] = str(destino_id)
        supabase.table("despesas_nao_operacionais").insert(nova_despesa).execute()


def renomear_versao(versao_id: UUID, nome_versao: str) -> dict[str, Any]:
    resp = supabase.table("versoes").update({"nome_versao": nome_versao}).eq("id", str(versao_id)).execute()
    return resp.data[0]


def excluir_versao(versao_id: UUID) -> None:
    try:
        supabase.table("versoes").delete().eq("id", str(versao_id)).execute()
    except PostgrestAPIError as exc:
        # Antes da migration 00006, isso disparava sempre que a versão tinha um
        # Cenário salvo (versao_snapshots.versao_a_id/versao_b_id) ou era origem
        # de outra versão duplicada (versoes.origem_versao_id) — essas 3 FKs
        # foram criadas em 00003 sem ON DELETE (= NO ACTION no Postgres), então
        # o DELETE aqui levantava "foreign key violation" (código 23503) sem
        # nenhum try/except, virando um 500 genérico do FastAPI. Mantido como
        # defesa mesmo após a correção das FKs — cobre qualquer violação futura
        # sem crashar sem log.
        logger.error(
            "Falha ao excluir versão versao_id=%s: code=%s message=%s details=%s hint=%s",
            versao_id, exc.code, exc.message, exc.details, exc.hint, exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "FALHA_AO_EXCLUIR_VERSAO",
                "message": "Não foi possível excluir esta versão. Tente novamente ou contate o suporte.",
            },
        ) from exc


# --------------------------------------------------------------------------- parâmetros

def get_parametros_versao(versao_id: UUID) -> dict[str, Any] | None:
    resp = supabase.table("parametros_versao").select("*").eq("versao_id", str(versao_id)).limit(1).execute()
    return resp.data[0] if resp.data else None


def upsert_parametros_versao(versao_id: UUID, dados: dict[str, Any]) -> dict[str, Any]:
    payload = {**dados, "versao_id": str(versao_id)}
    resp = supabase.table("parametros_versao").upsert(payload, on_conflict="versao_id").execute()
    return resp.data[0]


# --------------------------------------------------------------------------- linhas de receita/custo

def listar_linhas_receita(versao_id: UUID) -> list[dict[str, Any]]:
    return supabase.table("linhas_receita").select("*").eq("versao_id", str(versao_id)).execute().data


def listar_linhas_custo(versao_id: UUID) -> list[dict[str, Any]]:
    return supabase.table("linhas_custo").select("*").eq("versao_id", str(versao_id)).execute().data


def get_linha_receita_or_404(linha_id: UUID, versao_id: UUID) -> dict[str, Any]:
    resp = (
        supabase.table("linhas_receita")
        .select("*")
        .eq("id", str(linha_id))
        .eq("versao_id", str(versao_id))
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise _not_found("Linha de receita")
    return resp.data[0]


def get_linha_custo_or_404(linha_id: UUID, versao_id: UUID) -> dict[str, Any]:
    resp = (
        supabase.table("linhas_custo")
        .select("*")
        .eq("id", str(linha_id))
        .eq("versao_id", str(versao_id))
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise _not_found("Linha de custo")
    return resp.data[0]


def criar_linha_receita(versao_id: UUID, dados: dict[str, Any]) -> dict[str, Any]:
    payload = {**dados, "versao_id": str(versao_id)}
    return supabase.table("linhas_receita").insert(payload).execute().data[0]


def criar_linha_custo(versao_id: UUID, dados: dict[str, Any]) -> dict[str, Any]:
    payload = {**dados, "versao_id": str(versao_id)}
    return supabase.table("linhas_custo").insert(payload).execute().data[0]


def atualizar_linha_receita(linha_id: UUID, dados: dict[str, Any]) -> dict[str, Any]:
    return supabase.table("linhas_receita").update(dados).eq("id", str(linha_id)).execute().data[0]


def atualizar_linha_custo(linha_id: UUID, dados: dict[str, Any]) -> dict[str, Any]:
    return supabase.table("linhas_custo").update(dados).eq("id", str(linha_id)).execute().data[0]


def excluir_linha_receita(linha_id: UUID) -> None:
    supabase.table("linhas_receita").delete().eq("id", str(linha_id)).execute()


def excluir_linha_custo(linha_id: UUID) -> None:
    supabase.table("linhas_custo").delete().eq("id", str(linha_id)).execute()


def linha_receita_possui_override(linha_id: UUID) -> bool:
    resp = supabase.table("distribuicao_receita").select("id", count="exact").eq("linha_receita_id", str(linha_id)).execute()
    return (resp.count or 0) > 0


def linha_custo_possui_override(linha_id: UUID) -> bool:
    resp = supabase.table("distribuicao_custo").select("id", count="exact").eq("linha_custo_id", str(linha_id)).execute()
    return (resp.count or 0) > 0


# --------------------------------------------------------------------------- distribuição (cronograma)

def listar_distribuicao_receita(linha_id: UUID) -> dict[int, Any]:
    resp = supabase.table("distribuicao_receita").select("mes, volumetria").eq("linha_receita_id", str(linha_id)).execute()
    return {row["mes"]: row["volumetria"] for row in resp.data}


def listar_distribuicao_custo(linha_id: UUID) -> dict[int, Any]:
    resp = supabase.table("distribuicao_custo").select("mes, volumetria").eq("linha_custo_id", str(linha_id)).execute()
    return {row["mes"]: row["volumetria"] for row in resp.data}


def upsert_celula_distribuicao_receita(linha_id: UUID, mes: int, volumetria: Any) -> None:
    supabase.table("distribuicao_receita").upsert(
        {"linha_receita_id": str(linha_id), "mes": mes, "volumetria": str(volumetria)},
        on_conflict="linha_receita_id,mes",
    ).execute()


def upsert_celula_distribuicao_custo(linha_id: UUID, mes: int, volumetria: Any) -> None:
    supabase.table("distribuicao_custo").upsert(
        {"linha_custo_id": str(linha_id), "mes": mes, "volumetria": str(volumetria)},
        on_conflict="linha_custo_id,mes",
    ).execute()


def resetar_distribuicao_receita(linha_id: UUID) -> None:
    supabase.table("distribuicao_receita").delete().eq("linha_receita_id", str(linha_id)).execute()


def resetar_distribuicao_custo(linha_id: UUID) -> None:
    supabase.table("distribuicao_custo").delete().eq("linha_custo_id", str(linha_id)).execute()


# --------------------------------------------------------------------------- despesas não operacionais

def listar_despesas(versao_id: UUID) -> list[dict[str, Any]]:
    return supabase.table("despesas_nao_operacionais").select("*").eq("versao_id", str(versao_id)).execute().data


def get_despesa_or_404(despesa_id: UUID, versao_id: UUID) -> dict[str, Any]:
    """Escopa a despesa por versao_id — nunca aceitar despesa_id isoladamente (BOLA/IDOR)."""
    resp = (
        supabase.table("despesas_nao_operacionais")
        .select("*")
        .eq("id", str(despesa_id))
        .eq("versao_id", str(versao_id))
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise _not_found("Despesa não operacional")
    return resp.data[0]


def criar_despesa(versao_id: UUID, dados: dict[str, Any]) -> dict[str, Any]:
    payload = {**dados, "versao_id": str(versao_id)}
    return supabase.table("despesas_nao_operacionais").insert(payload).execute().data[0]


def atualizar_despesa(despesa_id: UUID, versao_id: UUID, dados: dict[str, Any]) -> dict[str, Any]:
    get_despesa_or_404(despesa_id, versao_id)
    return (
        supabase.table("despesas_nao_operacionais")
        .update(dados)
        .eq("id", str(despesa_id))
        .eq("versao_id", str(versao_id))
        .execute()
        .data[0]
    )


def excluir_despesa(despesa_id: UUID, versao_id: UUID) -> None:
    get_despesa_or_404(despesa_id, versao_id)
    supabase.table("despesas_nao_operacionais").delete().eq("id", str(despesa_id)).eq(
        "versao_id", str(versao_id)
    ).execute()


# --------------------------------------------------------------------------- snapshots

def listar_snapshots(contrato_id: UUID) -> list[dict[str, Any]]:
    return supabase.table("versao_snapshots").select("*").eq("contrato_id", str(contrato_id)).execute().data


def get_snapshot_or_404(snapshot_id: UUID, contrato_id: UUID) -> dict[str, Any]:
    """Escopa o snapshot por contrato_id — nunca aceitar snapshot_id isoladamente (BOLA/IDOR)."""
    resp = (
        supabase.table("versao_snapshots")
        .select("*")
        .eq("id", str(snapshot_id))
        .eq("contrato_id", str(contrato_id))
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise _not_found("Snapshot")
    return resp.data[0]


def criar_snapshot(contrato_id: UUID, created_by: UUID, dados: dict[str, Any]) -> dict[str, Any]:
    payload = {**dados, "contrato_id": str(contrato_id), "created_by": str(created_by)}
    return supabase.table("versao_snapshots").insert(payload).execute().data[0]


def excluir_snapshot(snapshot_id: UUID, contrato_id: UUID) -> None:
    get_snapshot_or_404(snapshot_id, contrato_id)
    supabase.table("versao_snapshots").delete().eq("id", str(snapshot_id)).eq("contrato_id", str(contrato_id)).execute()


# --------------------------------------------------------------------------- convites (Tela 10 — aceite)
#
# Estas consultas são por `token` (não por organization_id/user_id) porque quem
# chama ainda não está autenticado nem associado a nenhuma organização — é
# exatamente o caso em que a RLS de organization_invites ("Owner vê convites da
# própria organização") bloquearia o SELECT. O cliente `supabase` deste módulo já
# usa a service role key (ver cabeçalho do arquivo), então essas funções a
# contornam por construção; o token aleatório de 128 bits é o único fator de
# autorização válido aqui, nunca a sessão do chamador.

def get_convite_por_token(token: UUID) -> dict[str, Any] | None:
    resp = (
        supabase.table("organization_invites")
        .select("*, organizations(name)")
        .eq("token", str(token))
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def marcar_convite_aceito(convite_id: UUID, accepted_by: UUID) -> dict[str, Any]:
    resp = (
        supabase.table("organization_invites")
        .update({"status": "aceito", "accepted_by": str(accepted_by), "accepted_at": "now()"})
        .eq("id", str(convite_id))
        .execute()
    )
    return resp.data[0]


def criar_profile(user_id: UUID, full_name: str) -> dict[str, Any]:
    payload = {"id": str(user_id), "full_name": full_name}
    resp = supabase.table("profiles").insert(payload).execute()
    return resp.data[0]


def criar_membro_organizacao(organization_id: UUID, user_id: UUID, role: str) -> dict[str, Any]:
    payload = {
        "organization_id": str(organization_id),
        "user_id": str(user_id),
        "role": role,
        "active_modules": ["viabilidade"],
    }
    resp = supabase.table("organization_members").insert(payload).execute()
    return resp.data[0]


def criar_convite(organization_id: UUID, invited_by: UUID, email: str, role: str) -> dict[str, Any]:
    payload = {
        "organization_id": str(organization_id),
        "email": email,
        "role": role,
        "invited_by": str(invited_by),
    }
    resp = supabase.table("organization_invites").insert(payload).execute()
    return resp.data[0]
