"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/finance/states";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import { ApiError } from "@/lib/api/client";
import type { DespesaTipo } from "@/lib/types/viabilidade";

export default function ParametrosPage() {
  const { versaoId } = useParams<{ versaoId: string }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parâmetros de Input</h1>
        <p className="text-sm text-muted-foreground">
          Parâmetros gerais e linhas de Receita, Custo e Despesas Não Operacionais desta versão.
        </p>
      </div>

      <Tabs defaultValue="gerais">
        <TabsList>
          <TabsTrigger value="gerais">Parâmetros Gerais</TabsTrigger>
          <TabsTrigger value="receita">Receita</TabsTrigger>
          <TabsTrigger value="custo">Custo</TabsTrigger>
          <TabsTrigger value="despesas">Despesas Não Operacionais</TabsTrigger>
        </TabsList>

        <TabsContent value="gerais" className="pt-4">
          <ParametrosGeraisForm versaoId={versaoId} />
        </TabsContent>
        <TabsContent value="receita" className="pt-4">
          <TabelaReceita versaoId={versaoId} />
        </TabsContent>
        <TabsContent value="custo" className="pt-4">
          <TabelaCusto versaoId={versaoId} />
        </TabsContent>
        <TabsContent value="despesas" className="pt-4">
          <TabelaDespesas versaoId={versaoId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ParametrosGeraisForm({ versaoId }: { versaoId: string }) {
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.obterParametros(versaoId), [versaoId]);
  const [form, setForm] = useState({ aliquota: "", tma: "", reinvestimento: "", custoCaptacao: "" });
  const [salvando, setSalvando] = useState(false);

  // Ajuste de estado durante a renderização (padrão recomendado pelo React para
  // sincronizar um form editável com dados assíncronos, evitando o efeito
  // adicional e o re-render em cascata de um useEffect + setState).
  const [dadosCarregadosPara, setDadosCarregadosPara] = useState<typeof data>(null);
  if (data && data !== dadosCarregadosPara) {
    setDadosCarregadosPara(data);
    setForm({
      aliquota: data.aliquota_tributaria_efetiva ?? "",
      tma: data.tma ?? "",
      reinvestimento: data.taxa_reinvestimento ?? "",
      custoCaptacao: data.taxa_custo_captacao ?? "",
    });
  }

  async function salvar() {
    setSalvando(true);
    try {
      await viabilidadeApi.gravarParametros(versaoId, {
        aliquota_tributaria_efetiva: form.aliquota || "0",
        tma: form.tma || null,
        taxa_reinvestimento: form.reinvestimento || null,
        taxa_custo_captacao: form.custoCaptacao || null,
      });
      toast.success("Parâmetros salvos.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar os parâmetros.");
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <LoadingState rows={3} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Taxas e Alíquota</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Alíquota Tributária Efetiva (%)</Label>
          <Input value={form.aliquota} onChange={(e) => setForm({ ...form, aliquota: e.target.value })} placeholder="0.06" />
        </div>
        <div className="space-y-1.5">
          <Label>Taxa Mínima de Atratividade — TMA (%)</Label>
          <Input value={form.tma} onChange={(e) => setForm({ ...form, tma: e.target.value })} placeholder="Vazio = não calcular VPL" />
        </div>
        <div className="space-y-1.5">
          <Label>Taxa de Reinvestimento (%)</Label>
          <Input
            value={form.reinvestimento}
            onChange={(e) => setForm({ ...form, reinvestimento: e.target.value })}
            placeholder="Vazio = não calcular TIRM"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Taxa de Custo de Captação (%)</Label>
          <Input
            value={form.custoCaptacao}
            onChange={(e) => setForm({ ...form, custoCaptacao: e.target.value })}
            placeholder="Vazio = Custo Financeiro = 0"
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar parâmetros"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TabelaReceita({ versaoId }: { versaoId: string }) {
  const { data, loading, error, refetch } = useApiResource(
    () => viabilidadeApi.listarLinhasReceita(versaoId),
    [versaoId]
  );
  const [novaLinha, setNovaLinha] = useState({ descricao: "", unidade_medida: "", volumetria: "", valor_unitario: "" });
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (!novaLinha.descricao || !novaLinha.unidade_medida) {
      toast.error("Preencha ao menos Descrição e Unidade de Medida.");
      return;
    }
    setSalvando(true);
    try {
      await viabilidadeApi.criarLinhaReceita(versaoId, {
        descricao: novaLinha.descricao,
        unidade_medida: novaLinha.unidade_medida,
        volumetria: novaLinha.volumetria || "0",
        valor_unitario: novaLinha.valor_unitario || "0",
        mes_inicio: null,
        prazo_meses: null,
        aliquota_especifica: null,
      });
      setNovaLinha({ descricao: "", unidade_medida: "", volumetria: "", valor_unitario: "" });
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar a linha de receita.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(linhaId: string) {
    try {
      await viabilidadeApi.excluirLinhaReceita(versaoId, linhaId);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir a linha.");
    }
  }

  if (loading) return <LoadingState rows={3} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Volumetria</TableHead>
              <TableHead className="text-right">Valor Unitário</TableHead>
              <TableHead className="text-right">Total Calculado</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((linha) => (
              <TableRow key={linha.id}>
                <TableCell className="font-medium">{linha.descricao}</TableCell>
                <TableCell>{linha.unidade_medida}</TableCell>
                <TableCell className="text-right">{formatNumber(linha.volumetria)}</TableCell>
                <TableCell className="text-right">{formatCurrency(linha.valor_unitario)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(linha.valor_total_calculado)}</TableCell>
                <TableCell>
                  {linha.bloqueado_por_origem ? <Badge variant="outline">Importada</Badge> : null}
                  {linha.bloqueado_por_override ? (
                    <Badge variant="outline" className="ml-1">
                      Distribuição manual
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={linha.bloqueado_por_origem}
                    onClick={() => excluir(linha.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data && data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState title="Nenhuma linha de receita cadastrada" />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius-lg)] border border-dashed border-border/60 p-3">
        <div className="space-y-1">
          <Label className="text-xs">Descrição</Label>
          <Input
            className="w-48"
            value={novaLinha.descricao}
            onChange={(e) => setNovaLinha({ ...novaLinha, descricao: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unidade de Medida</Label>
          <Input
            className="w-32"
            value={novaLinha.unidade_medida}
            onChange={(e) => setNovaLinha({ ...novaLinha, unidade_medida: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Volumetria</Label>
          <Input
            className="w-32"
            value={novaLinha.volumetria}
            onChange={(e) => setNovaLinha({ ...novaLinha, volumetria: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valor Unitário</Label>
          <Input
            className="w-32"
            value={novaLinha.valor_unitario}
            onChange={(e) => setNovaLinha({ ...novaLinha, valor_unitario: e.target.value })}
          />
        </div>
        <Button onClick={adicionar} disabled={salvando}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar linha
        </Button>
      </div>
    </div>
  );
}

function TabelaCusto({ versaoId }: { versaoId: string }) {
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.listarLinhasCusto(versaoId), [versaoId]);
  const [novaLinha, setNovaLinha] = useState({ descricao: "", unidade_medida: "", volumetria: "", custo_unitario: "" });
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (!novaLinha.descricao || !novaLinha.unidade_medida) {
      toast.error("Preencha ao menos Descrição e Unidade de Medida.");
      return;
    }
    setSalvando(true);
    try {
      await viabilidadeApi.criarLinhaCusto(versaoId, {
        descricao: novaLinha.descricao,
        unidade_medida: novaLinha.unidade_medida,
        volumetria: novaLinha.volumetria || "0",
        custo_unitario: novaLinha.custo_unitario || "0",
        mes_inicio: null,
        prazo_meses: null,
      });
      setNovaLinha({ descricao: "", unidade_medida: "", volumetria: "", custo_unitario: "" });
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar a linha de custo.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(linhaId: string) {
    try {
      await viabilidadeApi.excluirLinhaCusto(versaoId, linhaId);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir a linha.");
    }
  }

  if (loading) return <LoadingState rows={3} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Volumetria</TableHead>
              <TableHead className="text-right">Custo Unitário</TableHead>
              <TableHead className="text-right">Total Calculado</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((linha) => (
              <TableRow key={linha.id}>
                <TableCell className="font-medium">{linha.descricao}</TableCell>
                <TableCell>{linha.unidade_medida}</TableCell>
                <TableCell className="text-right">{formatNumber(linha.volumetria)}</TableCell>
                <TableCell className="text-right">{formatCurrency(linha.custo_unitario)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(linha.custo_total_calculado)}</TableCell>
                <TableCell>{linha.bloqueado_por_origem ? <Badge variant="outline">Importada</Badge> : null}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" disabled={linha.bloqueado_por_origem} onClick={() => excluir(linha.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data && data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState title="Nenhuma linha de custo cadastrada" />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius-lg)] border border-dashed border-border/60 p-3">
        <div className="space-y-1">
          <Label className="text-xs">Descrição</Label>
          <Input
            className="w-48"
            value={novaLinha.descricao}
            onChange={(e) => setNovaLinha({ ...novaLinha, descricao: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unidade de Medida</Label>
          <Input
            className="w-32"
            value={novaLinha.unidade_medida}
            onChange={(e) => setNovaLinha({ ...novaLinha, unidade_medida: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Volumetria</Label>
          <Input
            className="w-32"
            value={novaLinha.volumetria}
            onChange={(e) => setNovaLinha({ ...novaLinha, volumetria: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Custo Unitário</Label>
          <Input
            className="w-32"
            value={novaLinha.custo_unitario}
            onChange={(e) => setNovaLinha({ ...novaLinha, custo_unitario: e.target.value })}
          />
        </div>
        <Button onClick={adicionar} disabled={salvando}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar linha
        </Button>
      </div>
    </div>
  );
}

function TabelaDespesas({ versaoId }: { versaoId: string }) {
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.listarDespesas(versaoId), [versaoId]);
  const [novaDespesa, setNovaDespesa] = useState<{ descricao: string; tipo: DespesaTipo; percentual: string }>({
    descricao: "",
    tipo: "despesa",
    percentual: "",
  });
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (!novaDespesa.descricao) {
      toast.error("Preencha a descrição da despesa.");
      return;
    }
    setSalvando(true);
    try {
      await viabilidadeApi.criarDespesa(versaoId, {
        descricao: novaDespesa.descricao,
        tipo: novaDespesa.tipo,
        percentual: novaDespesa.percentual || "0",
        linha_receita_referencia_id: null,
      });
      setNovaDespesa({ descricao: "", tipo: "despesa", percentual: "" });
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar a despesa.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(despesaId: string) {
    try {
      await viabilidadeApi.excluirDespesa(versaoId, despesaId);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir a despesa.");
    }
  }

  if (loading) return <LoadingState rows={3} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Sem referência a uma linha de Receita, o percentual é aplicado sobre a Receita Bruta Total do projeto. A linha
        de Custo Financeiro é automática e não aparece aqui — é derivada da Taxa de Custo de Captação.
      </p>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Percentual</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((despesa) => (
              <TableRow key={despesa.id}>
                <TableCell className="font-medium">{despesa.descricao}</TableCell>
                <TableCell>
                  <Badge variant={despesa.tipo === "despesa" ? "destructive" : "secondary"}>
                    {despesa.tipo === "despesa" ? "Despesa" : "Recuperação"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatNumber(Number(despesa.percentual) * 100)}%</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => excluir(despesa.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data && data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState title="Nenhuma despesa não operacional cadastrada" />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius-lg)] border border-dashed border-border/60 p-3">
        <div className="space-y-1">
          <Label className="text-xs">Descrição</Label>
          <Input
            className="w-48"
            value={novaDespesa.descricao}
            onChange={(e) => setNovaDespesa({ ...novaDespesa, descricao: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={novaDespesa.tipo}
            onValueChange={(v) => v && setNovaDespesa({ ...novaDespesa, tipo: v as DespesaTipo })}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="despesa">Despesa</SelectItem>
              <SelectItem value="recuperacao">Recuperação</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Percentual (ex: 0.10 = 10%)</Label>
          <Input
            className="w-32"
            value={novaDespesa.percentual}
            onChange={(e) => setNovaDespesa({ ...novaDespesa, percentual: e.target.value })}
          />
        </div>
        <Button onClick={adicionar} disabled={salvando}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar despesa
        </Button>
      </div>
    </div>
  );
}
