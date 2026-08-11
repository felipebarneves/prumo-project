"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PercentInput } from "@/components/finance/percent-input";
import { ScenarioCard } from "@/components/finance/scenario-card";
import { VersionSelect } from "@/components/finance/version-select";
import { EmptyState, ErrorState, LoadingState } from "@/components/finance/states";
import { formatCurrency, formatDate, formatMonth, formatPercent } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import { ApiError } from "@/lib/api/client";
import type { ComparacaoMetricas, Snapshot } from "@/lib/types/viabilidade";

type AbaCenarios = "comparar" | "whatif" | "salvos";

const ABAS_CENARIOS: { label: string; value: AbaCenarios }[] = [
  { label: "Comparar Versões", value: "comparar" },
  { label: "Simulação What-If", value: "whatif" },
  { label: "Cenários Salvos", value: "salvos" },
];

export default function CenariosPage() {
  const { contratoId, versaoId } = useParams<{ contratoId: string; versaoId: string }>();
  const [aba, setAba] = useState<AbaCenarios>("comparar");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gold-gradient font-[var(--font-display)] text-2xl font-bold">Cenários / What-If</h1>
        <p className="text-sm text-muted-foreground">Compare versões e simule ajustes paramétricos.</p>
      </div>

      <SegmentedControl options={ABAS_CENARIOS} value={aba} onChange={setAba} />

      <div className="pt-2">
        {aba === "comparar" ? <CompararVersoes contratoId={contratoId} versaoAtualId={versaoId} /> : null}
        {aba === "whatif" ? <SimulacaoWhatIf contratoId={contratoId} versaoAtualId={versaoId} /> : null}
        {aba === "salvos" ? <CenariosSalvos contratoId={contratoId} /> : null}
      </div>
    </div>
  );
}

const LINHAS_METRICAS: { chave: keyof ComparacaoMetricas; label: string; formato: "moeda" | "percentual" | "mes" }[] = [
  { chave: "receita_bruta", label: "Receita Bruta", formato: "moeda" },
  { chave: "impostos", label: "Impostos (Deduções)", formato: "moeda" },
  { chave: "receita_liquida", label: "Receita Líquida", formato: "moeda" },
  { chave: "custos_totais", label: "Custos Totais", formato: "moeda" },
  { chave: "ebitda", label: "EBITDA", formato: "moeda" },
  { chave: "margem_ebitda", label: "Margem EBITDA", formato: "percentual" },
  { chave: "payback_mes", label: "Payback", formato: "mes" },
];

function formatarMetrica(valor: string | number | null, formato: "moeda" | "percentual" | "mes") {
  if (valor === null) return "—";
  if (formato === "moeda") return formatCurrency(valor);
  if (formato === "percentual") return formatPercent(valor);
  return formatMonth(valor as number);
}

/** Par de cards lado a lado exibindo as métricas de duas colunas de resultado. */
function CardsComparacao({
  tituloA,
  tituloB,
  metricasA,
  metricasB,
}: {
  tituloA: string;
  tituloB: string;
  metricasA: ComparacaoMetricas;
  metricasB: ComparacaoMetricas;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[
        { titulo: tituloA, metricas: metricasA },
        { titulo: tituloB, metricas: metricasB },
      ].map(({ titulo, metricas }) => (
        <ScenarioCard key={titulo} title={<Badge variant="secondary" className="text-sm">{titulo}</Badge>}>
          {LINHAS_METRICAS.map(({ chave, label, formato }) => (
            <div key={chave} className="flex items-center justify-between rounded-[var(--radius-md)] px-2 py-1.5 odd:bg-muted/40">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-semibold">{formatarMetrica(metricas[chave], formato)}</span>
            </div>
          ))}
        </ScenarioCard>
      ))}
    </div>
  );
}

/** Caixa de rodapé para persistir a comparação/simulação atual como um cenário nomeado. */
function SalvarCenario({ onSalvar }: { onSalvar: (nome: string) => Promise<void> }) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe um nome para o cenário.");
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(nome.trim());
      toast.success("Cenário salvo.");
      setNome("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar o cenário.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="rounded-[var(--radius-lg)] border-dashed">
      <CardContent className="flex flex-wrap items-end gap-3 pt-4">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs">Salvar esta comparação</Label>
          <Input
            placeholder="Nome do cenário"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <Button
          onClick={salvar}
          disabled={salvando}
          className="bg-primary text-primary-foreground hover:bg-primary/85"
        >
          <Save className="mr-1 h-4 w-4" />
          {salvando ? "Salvando..." : "Salvar Cenário"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CompararVersoes({ contratoId, versaoAtualId }: { contratoId: string; versaoAtualId: string }) {
  const { data: versoes } = useApiResource(() => viabilidadeApi.listarVersoes(contratoId), [contratoId]);
  const [versaoA, setVersaoA] = useState(versaoAtualId);
  const [versaoB, setVersaoB] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ versao_a: ComparacaoMetricas; versao_b: ComparacaoMetricas } | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function comparar() {
    if (!versaoB) {
      toast.error("Selecione a versão do Cenário B.");
      return;
    }
    setCarregando(true);
    try {
      const resposta = await viabilidadeApi.compararVersoes(contratoId, versaoA, versaoB);
      setResultado(resposta);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível comparar as versões.");
    } finally {
      setCarregando(false);
    }
  }

  async function salvarCenario(nome: string) {
    if (!resultado || !versaoB) return;
    await viabilidadeApi.salvarSnapshot(contratoId, {
      tipo: "comparacao",
      nome,
      versao_a_id: versaoA,
      versao_b_id: versaoB,
      resultado,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Cenário A</Label>
          <VersionSelect versoes={versoes} versaoAtualId={versaoAtualId} value={versaoA} onChange={setVersaoA} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cenário B</Label>
          <VersionSelect
            versoes={versoes}
            versaoAtualId={versaoAtualId}
            value={versaoB}
            onChange={setVersaoB}
            placeholder="Selecione..."
          />
        </div>
        <Button onClick={comparar} disabled={carregando}>
          {carregando ? "Comparando..." : "Comparar"}
        </Button>
      </div>

      {resultado ? (
        <>
          <CardsComparacao
            tituloA="Cenário A"
            tituloB="Cenário B"
            metricasA={resultado.versao_a}
            metricasB={resultado.versao_b}
          />
          <SalvarCenario onSalvar={salvarCenario} />
        </>
      ) : null}
    </div>
  );
}

function SimulacaoWhatIf({ contratoId, versaoAtualId }: { contratoId: string; versaoAtualId: string }) {
  const { data: versoes } = useApiResource(() => viabilidadeApi.listarVersoes(contratoId), [contratoId]);
  const [versaoBase, setVersaoBase] = useState(versaoAtualId);
  const [ajustes, setAjustes] = useState({ receita: "0", custo: "0", volumetria: "0" });
  const [resultado, setResultado] = useState<{ versao_base: ComparacaoMetricas; resultado_simulado: ComparacaoMetricas } | null>(
    null
  );
  const [carregando, setCarregando] = useState(false);

  async function simular() {
    setCarregando(true);
    try {
      const resposta = await viabilidadeApi.simularWhatIf(contratoId, {
        versao_base_id: versaoBase,
        ajuste_receita_pct: ajustes.receita,
        ajuste_custo_pct: ajustes.custo,
        ajuste_volumetria_receita_pct: ajustes.volumetria,
      });
      setResultado(resposta);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível rodar a simulação.");
    } finally {
      setCarregando(false);
    }
  }

  async function salvarCenario(nome: string) {
    if (!resultado) return;
    await viabilidadeApi.salvarSnapshot(contratoId, {
      tipo: "whatif",
      nome,
      versao_a_id: versaoBase,
      ajustes_whatif: {
        versao_base_id: versaoBase,
        ajuste_receita_pct: ajustes.receita,
        ajuste_custo_pct: ajustes.custo,
        ajuste_volumetria_receita_pct: ajustes.volumetria,
      },
      resultado: {
        ...resultado,
        ajustes_aplicados: {
          versao_base_id: versaoBase,
          ajuste_receita_pct: ajustes.receita,
          ajuste_custo_pct: ajustes.custo,
          ajuste_volumetria_receita_pct: ajustes.volumetria,
        },
      },
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajustes percentuais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Versão-base</Label>
            <VersionSelect versoes={versoes} versaoAtualId={versaoAtualId} value={versaoBase} onChange={setVersaoBase} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ajuste de Receita (%)</Label>
            <PercentInput
              allowNegative
              value={ajustes.receita}
              onChange={(fracao) => setAjustes({ ...ajustes, receita: fracao || "0" })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ajuste de Custo (%)</Label>
            <PercentInput
              allowNegative
              value={ajustes.custo}
              onChange={(fracao) => setAjustes({ ...ajustes, custo: fracao || "0" })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ajuste de Volumetria (Receita) (%)</Label>
            <PercentInput
              allowNegative
              value={ajustes.volumetria}
              onChange={(fracao) => setAjustes({ ...ajustes, volumetria: fracao || "0" })}
            />
          </div>
          <div className="sm:col-span-4">
            <Button onClick={simular} disabled={carregando}>
              {carregando ? "Simulando..." : "Simular"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultado ? (
        <>
          <CardsComparacao
            tituloA="Versão-base"
            tituloB="Resultado Simulado"
            metricasA={resultado.versao_base}
            metricasB={resultado.resultado_simulado}
          />
          <SalvarCenario onSalvar={salvarCenario} />
        </>
      ) : null}
    </div>
  );
}

/** Extrai o EBITDA de um bloco de métricas dentro do `resultado` (jsonb) de um snapshot. */
function ebitdaDoResultado(resultado: Record<string, unknown>, chave: string): string | null {
  const bloco = resultado[chave];
  if (!bloco || typeof bloco !== "object") return null;
  const ebitda = (bloco as Record<string, unknown>).ebitda;
  return typeof ebitda === "string" || typeof ebitda === "number" ? String(ebitda) : null;
}

function CenariosSalvos({ contratoId }: { contratoId: string }) {
  const { data: versoes } = useApiResource(() => viabilidadeApi.listarVersoes(contratoId), [contratoId]);
  const { data: snapshots, loading, error, refetch } = useApiResource(
    () => viabilidadeApi.listarSnapshots(contratoId),
    [contratoId]
  );

  function nomeVersao(versaoId: string | null) {
    return versaoId ? versoes?.find((v) => v.id === versaoId)?.nome_versao ?? "—" : "—";
  }

  async function excluir(snapshot: Snapshot) {
    if (!confirm(`Excluir o cenário salvo "${snapshot.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await viabilidadeApi.excluirSnapshot(contratoId, snapshot.id);
      toast.success("Cenário excluído.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o cenário.");
    }
  }

  if (loading) return <LoadingState rows={3} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!snapshots || snapshots.length === 0) return <EmptyState title="Nenhum cenário salvo" />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {snapshots.map((snapshot) => {
        const chaveA = snapshot.tipo === "whatif" ? "versao_base" : "versao_a";
        const chaveB = snapshot.tipo === "whatif" ? "resultado_simulado" : "versao_b";
        const tituloA = snapshot.tipo === "whatif" ? "Versão-base" : nomeVersao(snapshot.versao_a_id);
        const tituloB = snapshot.tipo === "whatif" ? "Resultado Simulado" : nomeVersao(snapshot.versao_b_id);
        const ebitdaA = ebitdaDoResultado(snapshot.resultado, chaveA);
        const ebitdaB = ebitdaDoResultado(snapshot.resultado, chaveB);

        return (
          <ScenarioCard
            key={snapshot.id}
            title={
              <div className="space-y-1">
                <CardTitle className="text-base">{snapshot.nome}</CardTitle>
                <p className="text-xs text-muted-foreground">{formatDate(snapshot.created_at)}</p>
              </div>
            }
            status={{
              label: snapshot.tipo === "whatif" ? "What-If" : "Comparação",
              variant: snapshot.tipo === "whatif" ? "outline" : "secondary",
            }}
            footer={
              <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => excluir(snapshot)}>
                <Trash2 className="mr-1 h-4 w-4" />
                Excluir cenário
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-[var(--radius-md)] bg-muted/40 p-2">
                <p className="truncate text-xs text-muted-foreground">{tituloA}</p>
                <p className="font-semibold">{ebitdaA ? formatCurrency(ebitdaA) : "—"}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-muted/40 p-2">
                <p className="truncate text-xs text-muted-foreground">{tituloB}</p>
                <p className="font-semibold">{ebitdaB ? formatCurrency(ebitdaB) : "—"}</p>
              </div>
            </div>
          </ScenarioCard>
        );
      })}
    </div>
  );
}
