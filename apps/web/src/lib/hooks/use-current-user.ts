"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

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
 */
export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    async function carregar() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        if (!cancelado) setLoading(false);
        return;
      }

      const [{ data: profile }, { data: membership }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", authUser.id).single(),
        supabase
          .from("organization_members")
          .select("organizations(name)")
          .eq("user_id", authUser.id)
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelado) return;

      const fullName = profile?.full_name ?? authUser.email ?? "Usuário";
      const organizationName =
        (membership?.organizations as unknown as { name: string } | null)?.name ?? "—";

      setUser({
        fullName,
        email: authUser.email ?? "",
        initials: iniciaisDe(fullName),
        organizationName,
      });
      setLoading(false);
    }

    carregar().catch(() => {
      if (!cancelado) setLoading(false);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  return { user, loading };
}
