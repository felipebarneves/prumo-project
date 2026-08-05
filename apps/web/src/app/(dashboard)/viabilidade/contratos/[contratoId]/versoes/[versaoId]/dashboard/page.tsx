"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/finance/kpi-card";
import { AnnualBarChart } from "@/components/finance/annual-bar-chart";
import { ErrorState, LoadingState } from "@/components/finance/states";
import { formatCurrency, formatMonth, formatPercent } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";

/** PRD Tela 6 — resumo executivo de uma versão. Payback/Breakeven/VPL/TIR/TIRM
 * seguem a convenção `—` para "não calculado/não atingido" (nunca zero). */
export default function DashboardProjetoPage() {
  const { versaoId } = useParams<{ versaoId: string }>();
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.obterDashboardProjeto(versaoId), [versaoId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard do Projeto</h1>
        <p className="text-sm text-muted-foreground">Resumo executivo — KPIs de viabilidade financeira desta versão.</p>
      </div>

      {loading ? <LoadingState rows={4} /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {!loading && !error && data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard label="Receita Bruta Total" value={formatCurrency(data.kpis.receita_bruta_total)} />
            <KpiCard label="EBITDA Total" value={formatCurrency(data.kpis.ebitda_total)} secondary={`Margem ${formatPercent(data.kpis.margem_ebitda)}`} />
            <KpiCard label="Fluxo Líquido Total" value={formatCurrency(data.kpis.fluxo_liquido_total)} />
            <KpiCard label="Capital de Giro" value={formatCurrency(data.kpis.capital_de_giro)} />
            <KpiCard label="Custo Financeiro Total" value={formatCurrency(data.kpis.custo_financeiro_total)} />
            <KpiCard label="VPL" value={data.kpis.vpl ? formatCurrency(data.kpis.vpl) : "—"} />
            <KpiCard label="TIR" value={data.kpis.tir ? formatPercent(data.kpis.tir) : "—"} />
            <KpiCard label="TIRM" value={data.kpis.tirm ? formatPercent(data.kpis.tirm) : "—"} />
            <KpiCard label="Payback" value={data.kpis.payback_mes ? formatMonth(data.kpis.payback_mes) : "—"} />
            <KpiCard label="Breakeven" value={data.kpis.breakeven_mes ? formatMonth(data.kpis.breakeven_mes) : "—"} secondary="Ponto de equilíbrio" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">DRE por Ano</CardTitle>
              </CardHeader>
              <CardContent>
                <AnnualBarChart
                  categorias={data.grafico_dre_por_ano.map((s) => String(s.ano))}
                  series={[
                    { label: "Receita Líquida", color: "bg-primary" },
                    { label: "Custos", color: "bg-destructive" },
                    { label: "EBITDA", color: "bg-chart-3" },
                  ]}
                  valores={[
                    data.grafico_dre_por_ano.map((s) => Number(s.receita_liquida)),
                    data.grafico_dre_por_ano.map((s) => Number(s.custos)),
                    data.grafico_dre_por_ano.map((s) => Number(s.ebitda)),
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fluxo de Caixa por Ano</CardTitle>
              </CardHeader>
              <CardContent>
                <AnnualBarChart
                  categorias={data.grafico_fluxo_caixa_por_ano.map((s) => String(s.ano))}
                  series={[
                    { label: "Fluxo Anual", color: "bg-primary" },
                    { label: "Caixa Acumulado", color: "bg-chart-3" },
                  ]}
                  valores={[
                    data.grafico_fluxo_caixa_por_ano.map((s) => Number(s.fluxo_anual)),
                    data.grafico_fluxo_caixa_por_ano.map((s) => Number(s.caixa_acumulado)),
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
