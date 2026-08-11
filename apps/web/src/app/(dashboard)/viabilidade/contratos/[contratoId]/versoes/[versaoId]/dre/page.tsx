"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { TableContainer, TableHeaderGold } from "@/components/ui/table-container";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ErrorState, LoadingState } from "@/components/finance/states";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import type { GranularidadeResumo } from "@/lib/types/viabilidade";

const ROTULOS_ITEM: Record<string, string> = {
  receita_operacional_bruta: "Receita Operacional Bruta",
  deducoes: "(-) Deduções",
  receita_operacional_liquida: "Receita Operacional Líquida",
  custos_operacionais: "(-) Custos Operacionais",
  ebitda: "EBITDA",
  despesas_nao_operacionais: "(-) Despesas Não Operacionais",
  ebit: "EBIT",
  ebit_acumulado: "EBIT Acumulado",
  irpj: "(-) IRPJ",
  lucro_liquido: "Lucro Líquido",
  margem_ebitda: "Margem EBITDA",
  margem_ebit: "Margem EBIT",
  margem_liquida: "Margem Líquida",
};

const ITENS_PERCENTUAIS = new Set(["margem_ebitda", "margem_ebit", "margem_liquida"]);
const ITENS_DESTAQUE = new Set(["ebitda", "ebit", "lucro_liquido"]);

// Ordem de exibição da DRE Detalhada — indicadores (EBIT Acumulado, margens) logo
// abaixo da linha a que se referem, em vez da ordem de cálculo emitida pela API.
const ORDEM_DETALHADO = [
  "receita_operacional_bruta",
  "deducoes",
  "receita_operacional_liquida",
  "custos_operacionais",
  "ebitda",
  "margem_ebitda",
  "despesas_nao_operacionais",
  "ebit",
  "ebit_acumulado",
  "margem_ebit",
  "irpj",
  "lucro_liquido",
  "margem_liquida",
];

export default function DREPage() {
  const { versaoId } = useParams<{ versaoId: string }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">DRE — Demonstração de Resultado</h1>
        <p className="text-sm text-muted-foreground">Regime de competência pura, sem ajuste de prazo de pagamento.</p>
      </div>

      <Tabs defaultValue="detalhado">
        <TabsList>
          <TabsTrigger value="detalhado">Detalhado</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>
        <TabsContent value="detalhado" className="pt-4">
          <DREDetalhado versaoId={versaoId} />
        </TabsContent>
        <TabsContent value="resumo" className="pt-4">
          <ResumoDRE versaoId={versaoId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatarValor(item: string, valor: string) {
  return ITENS_PERCENTUAIS.has(item) ? formatPercent(valor) : formatCurrency(valor);
}

function DREDetalhado({ versaoId }: { versaoId: string }) {
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.obterDREDetalhado(versaoId), [versaoId]);

  if (loading) return <LoadingState rows={6} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const linhasOrdenadas = [...data.linhas].sort(
    (a, b) => ORDEM_DETALHADO.indexOf(a.item) - ORDEM_DETALHADO.indexOf(b.item)
  );

  return (
    <div className="space-y-3">
      <TableContainer>
        <Table>
          <TableHeaderGold>
            <TableHead className="sticky left-0 bg-card">Item</TableHead>
            <TableHead className="text-right">Total do Projeto</TableHead>
            {data.meses.map((mes) => (
              <TableHead key={mes} className="text-right">
                Mês {mes}
              </TableHead>
            ))}
          </TableHeaderGold>
          <TableBody>
            {linhasOrdenadas.map((linha) => (
              <TableRow key={linha.item} className={ITENS_DESTAQUE.has(linha.item) ? "font-semibold" : undefined}>
                <TableCell className="sticky left-0 bg-card">{ROTULOS_ITEM[linha.item] ?? linha.item}</TableCell>
                <TableCell className="text-right">{formatarValor(linha.item, linha.total_projeto)}</TableCell>
                {linha.valores_mensais.map((valorMensal) => (
                  <TableCell key={valorMensal.mes} className="text-right">
                    {linha.item === "ebit_acumulado" || !ITENS_PERCENTUAIS.has(linha.item)
                      ? formatarValor(linha.item, valorMensal.valor)
                      : formatPercent(valorMensal.valor)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <p className="text-xs text-muted-foreground">{data.nota_irpj}</p>
    </div>
  );
}

const OPCOES_PERIODICIDADE: { label: string; value: GranularidadeResumo }[] = [
  { label: "12M", value: "anual" },
  { label: "6M", value: "semestral" },
  { label: "3M", value: "trimestral" },
];

function SeletorPeriodicidade({
  valor,
  onChange,
}: {
  valor: GranularidadeResumo;
  onChange: (valor: GranularidadeResumo) => void;
}) {
  return <SegmentedControl options={OPCOES_PERIODICIDADE} value={valor} onChange={onChange} />;
}

function ResumoDRE({ versaoId }: { versaoId: string }) {
  const [granularidade, setGranularidade] = useState<GranularidadeResumo>("anual");
  const { data, loading, error, refetch } = useApiResource(
    () => viabilidadeApi.obterResumoDRE(versaoId, granularidade),
    [versaoId, granularidade]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data ? `${data.inicio_projeto} — ${data.prazo_meses} meses` : ""}
        </p>
        <SeletorPeriodicidade valor={granularidade} onChange={setGranularidade} />
      </div>

      {loading ? <LoadingState rows={6} /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {!loading && !error && data ? (
        <TableContainer>
          <Table>
            <TableHeaderGold>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Total do Projeto</TableHead>
              {data.linhas[0]?.periodos.map((periodo) => (
                <TableHead key={periodo.periodo_label} className="text-right">
                  {periodo.periodo_label}
                </TableHead>
              ))}
            </TableHeaderGold>
            <TableBody>
              {data.linhas.map((linha) => (
                <TableRow key={linha.item} className={ITENS_DESTAQUE.has(linha.item) ? "font-semibold" : undefined}>
                  <TableCell>{ROTULOS_ITEM[linha.item] ?? linha.item}</TableCell>
                  <TableCell className="text-right">{formatarValor(linha.item, linha.total_projeto)}</TableCell>
                  {linha.periodos.map((periodo) => (
                    <TableCell key={periodo.periodo_label} className="text-right">
                      {formatarValor(linha.item, periodo.valor)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}

      {data ? <p className="text-xs text-muted-foreground">{data.nota_irpj}</p> : null}
    </div>
  );
}
