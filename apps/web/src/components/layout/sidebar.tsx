"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  ChevronsLeft,
  ChevronsRight,
  Clock,
  FileBarChart,
  Gauge,
  GitCompareArrows,
  History,
  ListChecks,
  LogOut,
  Settings,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  slug: string;
  icon: React.ComponentType<{ className?: string }>;
  /** true para itens que não dependem de um projeto/versão ativos (ex: Projetos). */
  global?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", slug: "dashboard", icon: Gauge },
  { label: "Projetos", slug: "", icon: ListChecks, global: true },
  { label: "Parâmetros", slug: "parametros", icon: SlidersHorizontal },
  { label: "Cronograma", slug: "cronograma", icon: Clock },
  { label: "DRE", slug: "dre", icon: FileBarChart },
  { label: "Fluxo de Caixa", slug: "fluxo-caixa", icon: Wallet },
  { label: "Cenários", slug: "cenarios", icon: GitCompareArrows },
  { label: "Histórico", slug: "historico", icon: History },
  { label: "Configurações", slug: "configuracoes", icon: Settings },
];

export function Sidebar() {
  const [colapsada, setColapsada] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ contratoId?: string; versaoId?: string }>();
  const { user, loading: carregandoUsuario } = useCurrentUser();

  const contratoId = Array.isArray(params?.contratoId) ? params.contratoId[0] : params?.contratoId;
  const versaoId = Array.isArray(params?.versaoId) ? params.versaoId[0] : params?.versaoId;
  const temProjetoAtivo = Boolean(contratoId && versaoId);

  async function handleSair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function hrefDoItem(item: NavItem): string {
    if (item.global) return "/viabilidade";
    if (!temProjetoAtivo) return "#";
    return `/viabilidade/contratos/${contratoId}/versoes/${versaoId}/${item.slug}`;
  }

  function ativoDoItem(item: NavItem): boolean {
    if (item.global) return pathname === "/viabilidade";
    return temProjetoAtivo ? pathname.endsWith(`/${item.slug}`) : false;
  }

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border/60 bg-card/40 transition-[width] duration-150 md:flex",
          colapsada ? "w-16" : "w-64"
        )}
      >
        {/* Topo — organização ativa + tag do módulo + colapsar */}
        <div className={cn("flex items-center gap-2 px-4 py-5", colapsada && "justify-center px-0")}>
          {!colapsada ? (
            <div className="min-w-0 flex-1">
              <p className="truncate font-[var(--font-display)] text-sm font-bold text-foreground">
                {carregandoUsuario ? "Carregando..." : user?.organizationName ?? "—"}
              </p>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-gold-1">
                Prumo Viabilidade
              </p>
            </div>
          ) : null}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setColapsada((v) => !v)}
                  aria-label={colapsada ? "Expandir menu" : "Colapsar menu"}
                >
                  {colapsada ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                </Button>
              }
            />
            <TooltipContent side="right">{colapsada ? "Expandir" : "Colapsar"}</TooltipContent>
          </Tooltip>
        </div>

        <Separator />

        {/* Navegação */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const ativo = ativoDoItem(item);
            const desabilitado = !item.global && !temProjetoAtivo;
            const link = (
              <Link
                key={item.label}
                href={hrefDoItem(item)}
                aria-disabled={desabilitado}
                onClick={(e) => {
                  if (desabilitado) e.preventDefault();
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  colapsada && "justify-center px-0",
                  ativo
                    ? "bg-accent text-accent-foreground"
                    : "text-silver hover:bg-accent hover:text-accent-foreground",
                  desabilitado && "pointer-events-none opacity-40"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!colapsada ? <span className="truncate">{item.label}</span> : null}
              </Link>
            );

            if (!colapsada) return link;

            return (
              <Tooltip key={item.label}>
                <TooltipTrigger render={link} />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <Separator />

        {/* Rodapé — perfil do usuário logado */}
        <div className={cn("flex items-center gap-2 px-3 py-4", colapsada && "flex-col justify-center px-0")}>
          <Avatar size="sm">
            <AvatarFallback>{carregandoUsuario ? "…" : user?.initials ?? "?"}</AvatarFallback>
          </Avatar>
          {!colapsada ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {carregandoUsuario ? "Carregando..." : user?.fullName ?? "Usuário"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
            </div>
          ) : null}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="ghost" size="icon-sm" onClick={handleSair} aria-label="Sair">
                  <LogOut className="h-4 w-4" />
                </Button>
              }
            />
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
