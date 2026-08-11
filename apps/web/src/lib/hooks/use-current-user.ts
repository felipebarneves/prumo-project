"use client";

import { useEffect, useState } from "react";
import { authApi } from "@/lib/api/auth";

export interface CurrentUser {
  fullName: string;
  email: string;
  initials: string;
  organizationName: string;
}

function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

/**
 * Perfil + organização do usuário logado, para o rodapé/topo da Sidebar.
 * Sem cache/assinatura em tempo real — busca uma vez ao montar, suficiente
 * para o propósito de exibição (nome, e-mail, org ativa), não de autorização.
 *
 * Busca via `GET /api/v1/auth/me` (backend, service role) em vez de consultar
 * `profiles`/`organization_members` diretamente pelo client Supabase — essas
 * tabelas têm RLS habilitado sem nenhuma política de SELECT (supabase/migrations/
 * 00001_initial_schema.sql), então a consulta direta do client sempre retornava
 * vazio: nome caía no fallback do e-mail (duplicando e-mail no rodapé da Sidebar)
 * e a organização sempre exibia "—" no topo.
 */
export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    authApi
      .obterMeuPerfil()
      .then((me) => {
        if (cancelado) return;
        setUser({
          fullName: me.full_name,
          email: me.email,
          initials: iniciaisDe(me.full_name),
          organizationName: me.organization_name,
        });
      })
      .catch(() => {
        // Sessão ausente/expirada ou falha de rede — a Sidebar já trata `user === null`
        // exibindo os fallbacks padrão ("Usuário", "—"), sem necessidade de estado de erro aqui.
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return { user, loading };
}
