"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/finance/states";
import { PercentInput } from "@/components/finance/percent-input";
import { formatCurrency, formatDate, formatMonth, formatPercent } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import { ApiError } from "@/lib/api/client";
import type { ComparacaoMetricas } from "@/lib/types/viabilidade";

export default function CenariosPage() {
  const { contratoId, versaoId } = useParams<{ contratoId: string; versaoId: string }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cenários / What-If / Versões</h1>
        <p className="text-sm text-muted-foreground">Compare versões, simule ajustes paramétricos e gerencie o histórico.</p>
      </div>

      <Tabs defaultValue="comparar">
        <TabsList>
          <TabsTrigger value="comparar">Comparar Versões</TabsTrigger>
          <TabsTrigger value="whatif">Simulação What-If</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Versões</TabsTrigger>
        </TabsList>
        <TabsContent value="comparar" className="pt-4">
          <CompararVersoes contratoId={contratoId} versaoAtualId={versaoId} />
        </TabsContent>
        <TabsContent value="whatif" className="pt-4">
          <SimulacaoWhatIf contratoId={contratoId} versaoAtualId={versaoId} />
        </TabsContent>
        <TabsContent value="historico" className="pt-4">
          <HistoricoVersoes contratoId={contratoId} versaoAtualId={versaoId} />
        </TabsContent>
      </Tabs>
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

function CompararVersoes({ contratoId, versaoAtualId }: { contratoId: string; versaoAtualId: string }) {
  const { data: versoes } = useApiResource(() => viabilidadeApi.listarVersoes(contratoId), [contratoId]);
  const [versaoA, setVersaoA] = useState(versaoAtualId);
  const [versaoB, setVersaoB] = useState<string | undefined>(undefined);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Cenário A</Label>
          <Select value={versaoA} onValueChange={(v) => v && setVersaoA(v)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versoes?.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome_versao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cenário B</Label>
          <Select value={versaoB} onValueChange={(v) => setVersaoB(v ?? undefined)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {versoes?.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome_versao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={comparar} disabled={carregando}>
          {carregando ? "Comparando..." : "Comparar"}
        </Button>
      </div>

      {resultado ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Cenário A</TableHead>
                <TableHead className="text-right">Cenário B</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LINHAS_METRICAS.map(({ chave, label, formato }) => (
                <TableRow key={chave}>
                  <TableCell>{label}</TableCell>
                  <TableCell className="text-right">{formatarMetrica(resultado.versao_a[chave], formato)}</TableCell>
                  <TableCell className="text-right">{formatarMetrica(resultado.versao_b[chave], formato)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajustes percentuais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Versão-base</Label>
            <Select value={versaoBase} onValueChange={(v) => v && setVersaoBase(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versoes?.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome_versao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Versão-base</TableHead>
                <TableHead className="text-right">Resultado Simulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LINHAS_METRICAS.map(({ chave, label, formato }) => (
                <TableRow key={chave}>
                  <TableCell>{label}</TableCell>
                  <TableCell className="text-right">{formatarMetrica(resultado.versao_base[chave], formato)}</TableCell>
                  <TableCell className="text-right">{formatarMetrica(resultado.resultado_simulado[chave], formato)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

function HistoricoVersoes({ contratoId, versaoAtualId }: { contratoId: string; versaoAtualId: string }) {
  const router = useRouter();
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.listarVersoes(contratoId), [contratoId]);
  const [novoNome, setNovoNome] = useState("");

  async function criarVersao(origemVersaoId?: string) {
    const nome = novoNome.trim() || "Nova versão";
    try {
      const versao = await viabilidadeApi.criarVersao(contratoId, nome, origemVersaoId ?? null);
      toast.success("Versão criada.");
      setNovoNome("");
      refetch();
      router.push(`/viabilidade/contratos/${contratoId}/versoes/${versao.id}/parametros`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar a versão.");
    }
  }

  async function excluirVersao(versaoId: string) {
    if (!confirm("Esta ação vai excluir permanentemente a versão e todos os seus dados. Deseja continuar?")) return;
    try {
      const resultado = await viabilidadeApi.excluirVersao(contratoId, versaoId);
      toast.success("Versão excluída.");
      refetch();
      if (versaoId === versaoAtualId && resultado.versao_substituta_id) {
        router.push(`/viabilidade/contratos/${contratoId}/versoes/${resultado.versao_substituta_id}/parametros`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir a versão.");
    }
  }

  async function renomear(versaoId: string, nomeAtual: string) {
    const novo = prompt("Novo nome da versão:", nomeAtual);
    if (!novo || novo === nomeAtual) return;
    try {
      await viabilidadeApi.renomearVersao(contratoId, versaoId, novo);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível renomear a versão.");
    }
  }

  if (loading) return <LoadingState rows={3} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Nome da nova versão</Label>
          <Input className="w-64" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
        </div>
        <Button onClick={() => criarVersao()}>
          <Plus className="mr-1 h-4 w-4" />
          Nova versão em branco
        </Button>
      </div>

      {data && data.length > 0 ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Vínculo Precificação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((versao) => (
                <TableRow key={versao.id} className={versao.id === versaoAtualId ? "bg-accent/40" : undefined}>
                  <TableCell className="font-medium">{versao.nome_versao}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(versao.created_at)}</TableCell>
                  <TableCell>{versao.vinculo_precificacao_ativo ? "Vinculada" : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/viabilidade/contratos/${contratoId}/versoes/${versao.id}/parametros`)}
                    >
                      Abrir
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => renomear(versao.id, versao.nome_versao)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => criarVersao(versao.id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => excluirVersao(versao.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="Nenhuma versão encontrada" />
      )}
    </div>
  );
}
