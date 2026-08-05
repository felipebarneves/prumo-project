"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import { cn } from "@/lib/utils";

const ABAS = [
  { slug: "parametros", label: "Parâmetros" },
  { slug: "cronograma", label: "Cronograma" },
  { slug: "dre", label: "DRE" },
  { slug: "fluxo-caixa", label: "Fluxo de Caixa" },
  { slug: "dashboard", label: "Dashboard" },
  { slug: "cenarios", label: "Cenários" },
] as const;

/**
 * Seletor de Versão global (PRD Tela 2, seção 2b) — componente compartilhado no
 * cabeçalho das Telas 2 a 6, especificado uma única vez aqui. Trocar a versão
 * altera o contexto de todas as telas simultaneamente (navegação para a mesma
 * aba, sob a nova versao_id). A proteção contra perda de dado nas Telas 2 e 3
 * (alterações não salvas) é responsabilidade de cada página de edição, não
 * deste layout — ver nota em parametros/page.tsx e cronograma/page.tsx.
 */
export default function VersaoLayout({ children }: { children: React.ReactNode }) {
  const { contratoId, versaoId } = useParams<{ contratoId: string; versaoId: string }>();
  const pathname = usePathname();
  const router = useRouter();

  const { data: versoes, loading } = useApiResource(() => viabilidadeApi.listarVersoes(contratoId), [contratoId]);

  const abaAtiva = ABAS.find((aba) => pathname.endsWith(`/${aba.slug}`))?.slug ?? "parametros";

  function trocarVersao(novaVersaoId: string) {
    router.push(`/viabilidade/contratos/${contratoId}/versoes/${novaVersaoId}/${abaAtiva}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <nav className="flex flex-wrap gap-1">
          {ABAS.map((aba) => (
            <Link
              key={aba.slug}
              href={`/viabilidade/contratos/${contratoId}/versoes/${versaoId}/${aba.slug}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                abaAtiva === aba.slug
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {aba.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">Versão</span>
          {loading || !versoes ? (
            <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
          ) : (
            <Select value={versaoId} onValueChange={(v) => v && trocarVersao(v)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versoes.map((versao) => (
                  <SelectItem key={versao.id} value={versao.id}>
                    {versao.nome_versao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
