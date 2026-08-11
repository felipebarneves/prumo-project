"use client";

import { useParams } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { TableContainer, TableHeaderGold } from "@/components/ui/table-container";
import { MetricCard } from "@/components/finance/metric-card";
import { MonthTableHead } from "@/components/finance/month-table-head";
import { ErrorState, LoadingState } from "@/components/finance/states";
import { formatCurrency } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";

const ROTULOS_ITEM: Record<string, string> = {
  entrada_caixa: "Entrada de Caixa",
  deducoes: "(-) Deduções",
  saida_caixa: "(-) Saída de Caixa",
  fluxo_liquido_operacional: "Fluxo Líquido Operacional",
  despesas_nao_operacionais: "(-) Despesas Não Operacionais",
  irpj: "(-) IRPJ",
  fluxo_liquido_geral: "Fluxo Líquido Geral",
  fluxo_acumulado: "Fluxo Acumulado",
  custo_financeiro: "(-) Custo Financeiro",
  saldo_caixa_final: "Saldo de Caixa Final",
};

const ITENS_DESTAQUE = new Set(["fluxo_liquido_geral", "fluxo_acumulado", "saldo_caixa_final"]);

export default function FluxoCaixaPage() {
  const { contratoId, versaoId } = useParams<{ contratoId: string; versaoId: string }>();
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.obterFluxoCaixa(versaoId), [versaoId]);
  const { data: contrato } = useApiResource(() => viabilidadeApi.obterContrato(contratoId), [contratoId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gold-gradient font-[var(--font-display)] text-2xl font-bold">Fluxo de Caixa</h1>
        <p className="text-sm text-muted-foreground">
          Regime de caixa — Receita deslocada pelo Prazo de Pagamento, demais itens em competência.
        </p>
      </div>

      {loading ? <LoadingState rows={6} /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {!loading && !error && data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Capital de Giro"
              value={formatCurrency(data.capital_de_giro, { casasDecimais: 0 })}
              secondary="Pico de necessidade de caixa"
            />
            <MetricCard
              label="Saldo de Caixa Final"
              value={formatCurrency(
                data.linhas.find((l) => l.item === "saldo_caixa_final")?.total_projeto ?? "0",
                { casasDecimais: 0 }
              )}
              secondary="Base de VPL / TIR / TIRM"
            />
          </div>

          <TableContainer>
            <Table>
              <TableHeaderGold>
                <TableHead className="sticky left-0 bg-card">Item</TableHead>
                <TableHead className="text-right">Total do Projeto</TableHead>
                {data.meses.map((mes) => (
                  <MonthTableHead key={mes} mes={mes} dataInicio={contrato?.data_inicio} />
                ))}
              </TableHeaderGold>
              <TableBody>
                {data.linhas.map((linha) => (
                  <TableRow key={linha.item} className={ITENS_DESTAQUE.has(linha.item) ? "font-semibold" : undefined}>
                    <TableCell className="sticky left-0 bg-card">{ROTULOS_ITEM[linha.item] ?? linha.item}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(linha.total_projeto, { casasDecimais: 0 })}
                    </TableCell>
                    {linha.valores_mensais.map((valor, index) => (
                      <TableCell key={index} className="text-right">
                        {formatCurrency(valor, { casasDecimais: 0 })}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : null}
    </div>
  );
}
