"use client";

import { MetricCard } from "@/components/finance/metric-card";
import { ErrorState, LoadingState } from "@/components/finance/states";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";

/**
 * PRD Tela 8 — agregação entre todos os projetos Viabilidade não-arquivados da
 * organização, sempre pela versão mais recente de cada projeto. VPL/TIR/TIRM/
 * Payback/Breakeven/Capital de Giro não são agregados aqui por decisão de
 * escopo (janelas de projeto desalinhadas) — permanecem exclusivos da Tela 6.
 */
export default function HomeOrganizacaoPage() {
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.obterHomeOrganizacao(), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Home da Organização</h1>
        <p className="text-sm text-muted-foreground">
          Resumo agregado do módulo Viabilidade — todos os projetos não-arquivados.
        </p>
      </div>

      {loading ? <LoadingState rows={4} /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {!loading && !error && data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Receita Bruta Total" value={formatCurrency(data.kpis.receita_bruta_total)} />
          <MetricCard
            label="EBITDA Total"
            value={formatCurrency(data.kpis.ebitda_total)}
            secondary={`Margem ${formatPercent(data.kpis.margem_ebitda)}`}
          />
          <MetricCard
            label="Contratos Ativos"
            value={`${data.kpis.contratos_ativos_atual} de ${data.kpis.contratos_ativos_limite}`}
            secondary="Limite do plano contratado"
          />
        </div>
      ) : null}
    </div>
  );
}
