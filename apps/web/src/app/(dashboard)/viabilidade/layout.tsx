import Link from "next/link";
import { Building2, LayoutDashboard } from "lucide-react";

/**
 * Shell do módulo Viabilidade — navegação de nível 1 (Projetos / Home da Organização).
 * A navegação de nível 2 (Parâmetros, Cronograma, DRE, Fluxo de Caixa, Dashboard,
 * Cenários) vive em contratos/[contratoId]/versoes/[versaoId]/layout.tsx, escopada
 * ao contexto de uma versão — ver PRD Tela 2, seção 2b (Seletor de Versão global).
 */
export default function ViabilidadeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-border/60 bg-card/40 px-4 py-6 md:flex md:flex-col md:gap-1">
        <div className="mb-6 px-2">
          <p className="font-[var(--font-display)] text-sm font-bold text-foreground">Prumo</p>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">Viabilidade</p>
        </div>

        <nav className="flex flex-col gap-1">
          <Link
            href="/viabilidade"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-silver transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Building2 className="h-4 w-4" />
            Projetos
          </Link>
          <Link
            href="/viabilidade/home"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-silver transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LayoutDashboard className="h-4 w-4" />
            Home da Organização
          </Link>
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
