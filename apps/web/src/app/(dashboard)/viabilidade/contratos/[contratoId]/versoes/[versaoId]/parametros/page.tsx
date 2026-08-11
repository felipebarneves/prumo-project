"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { TableContainer, TableHeaderGold } from "@/components/ui/table-container";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MetricCard } from "@/components/finance/metric-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/finance/states";
import { PercentInput } from "@/components/finance/percent-input";
import { CurrencyInput } from "@/components/finance/currency-input";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import { ApiError } from "@/lib/api/client";
import type { DespesaNaoOperacional, DespesaTipo, LinhaCusto, LinhaReceita, PrazoPagamento } from "@/lib/types/viabilidade";

const UNIDADES_MEDIDA = ["unitario", "mensal", "hora", "km"] as const;

type AbaParametros = "gerais" | "receita" | "custo" | "despesas";

const ABAS: { label: string; value: AbaParametros }[] = [
  { label: "Parâmetros Gerais", value: "gerais" },
  { label: "Receita", value: "receita" },
  { label: "Custo", value: "custo" },
  { label: "Despesas Não Operacionais", value: "despesas" },
];

export default function ParametrosPage() {
  const { contratoId, versaoId } = useParams<{ contratoId: string; versaoId: string }>();
  const [aba, setAba] = useState<AbaParametros>("gerais");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gold-gradient font-[var(--font-display)] text-2xl font-bold">Parâmetros de Input</h1>
        <p className="text-sm text-muted-foreground">
          Parâmetros gerais e linhas de Receita, Custo e Despesas Não Operacionais desta versão.
        </p>
      </div>

      <SegmentedControl options={ABAS} value={aba} onChange={setAba} />

      {aba === "gerais" ? (
        <div className="space-y-4">
          <InformacoesGeraisForm contratoId={contratoId} versaoId={versaoId} />
          <ParametrosGeraisForm versaoId={versaoId} />
        </div>
      ) : null}
      {aba === "receita" ? <TabelaReceita versaoId={versaoId} /> : null}
      {aba === "custo" ? <TabelaCusto versaoId={versaoId} /> : null}
      {aba === "despesas" ? <TabelaDespesas versaoId={versaoId} /> : null}
    </div>
  );
}

const PRAZOS_PAGAMENTO: { value: PrazoPagamento; label: string }[] = [
  { value: 30, label: "30 dias" },
  { value: 60, label: "60 dias" },
  { value: 90, label: "90 dias" },
];

/**
 * Card "Informações Gerais" — espelha 100% dos campos coletados na tela de
 * cadastro inicial (NovoProjetoDialog): Nome do Projeto, Cliente, Nome da
 * Versão, Data de Início, Duração, Prazo de Pagamento e Observações. Nome do
 * Projeto/Cliente/Data/Duração/Prazo vivem em `contratos` (PATCH /api/v1/
 * contratos/{id}, já existente); Nome da Versão vive em `versoes` (PATCH
 * /api/v1/contratos/{id}/versoes/{id}, já existente) — dois recursos
 * diferentes, dois PATCHs, um único botão Salvar dispara ambos.
 *
 * Prazo de Pagamento não tem opção "personalizado": a coluna
 * `contratos.prazo_pagamento_dias` tem `CHECK (... IN (30, 60, 90))` no banco
 * porque o Fluxo de Caixa desloca a Receita por esse prazo em dias corridos —
 * um valor arbitrário exigiria validar a lógica de deslocamento do zero, fora
 * do escopo desta tela.
 */
function InformacoesGeraisForm({ contratoId, versaoId }: { contratoId: string; versaoId: string }) {
  const { data: contrato, loading: loadingContrato, error: errorContrato, refetch: refetchContrato } = useApiResource(
    () => viabilidadeApi.obterContrato(contratoId),
    [contratoId]
  );
  const { data: versoes, loading: loadingVersoes, error: errorVersoes, refetch: refetchVersoes } = useApiResource(
    () => viabilidadeApi.listarVersoes(contratoId),
    [contratoId]
  );
  const versaoAtual = versoes?.find((v) => v.id === versaoId);

  const [form, setForm] = useState({
    nome_projeto: "",
    cliente: "",
    nome_versao: "",
    data_inicio: "",
    duracao_meses: 0,
    prazo_pagamento_dias: 30 as PrazoPagamento,
    observacoes: "",
  });
  const [salvando, setSalvando] = useState(false);

  // Ajuste de estado durante a renderização (mesmo padrão de ParametrosGeraisForm)
  // — sincroniza o form com contrato + versão assim que os dois chegam, sem useEffect.
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null);
  const chaveAtual = contrato && versaoAtual ? `${contrato.id}:${versaoAtual.id}` : null;
  if (contrato && versaoAtual && chaveAtual !== carregadoPara) {
    setCarregadoPara(chaveAtual);
    setForm({
      nome_projeto: contrato.nome_projeto,
      cliente: contrato.cliente,
      nome_versao: versaoAtual.nome_versao,
      data_inicio: contrato.data_inicio,
      duracao_meses: contrato.duracao_meses,
      prazo_pagamento_dias: contrato.prazo_pagamento_dias,
      observacoes: contrato.observacoes ?? "",
    });
  }

  async function salvar() {
    if (!form.nome_projeto.trim() || !form.cliente.trim() || !form.nome_versao.trim()) {
      toast.error("Preencha Nome do Projeto, Cliente e Nome da Versão.");
      return;
    }
    setSalvando(true);
    try {
      await Promise.all([
        viabilidadeApi.atualizarContrato(contratoId, {
          nome_projeto: form.nome_projeto.trim(),
          cliente: form.cliente.trim(),
          data_inicio: form.data_inicio,
          duracao_meses: form.duracao_meses,
          prazo_pagamento_dias: form.prazo_pagamento_dias,
          observacoes: form.observacoes.trim() || null,
        }),
        versaoAtual && form.nome_versao.trim() !== versaoAtual.nome_versao
          ? viabilidadeApi.renomearVersao(contratoId, versaoId, form.nome_versao.trim())
          : Promise.resolve(),
      ]);
      toast.success("Informações gerais salvas.");
      refetchContrato();
      refetchVersoes();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar as informações gerais.");
    } finally {
      setSalvando(false);
    }
  }

  if (loadingContrato || loadingVersoes) return <LoadingState rows={3} />;
  if (errorContrato) return <ErrorState message={errorContrato} onRetry={refetchContrato} />;
  if (errorVersoes) return <ErrorState message={errorVersoes} onRetry={refetchVersoes} />;

  return (
    <Card className="rounded-[var(--radius-lg)]">
      <CardHeader>
        <CardTitle className="text-base">Informações Gerais</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome do Projeto</Label>
          <Input value={form.nome_projeto} onChange={(e) => setForm({ ...form, nome_projeto: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Cliente</Label>
          <Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Nome da Versão</Label>
          <Input value={form.nome_versao} onChange={(e) => setForm({ ...form, nome_versao: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Mês/Ano de Início</Label>
          <Input
            type="date"
            value={form.data_inicio}
            onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Duração (meses)</Label>
          <Input
            type="number"
            min={1}
            value={form.duracao_meses || ""}
            onChange={(e) => setForm({ ...form, duracao_meses: e.target.value === "" ? 0 : Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Prazo de Pagamento</Label>
          <Select
            value={String(form.prazo_pagamento_dias)}
            onValueChange={(v) => v && setForm({ ...form, prazo_pagamento_dias: Number(v) as PrazoPagamento })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRAZOS_PAGAMENTO.map((opcao) => (
                <SelectItem key={opcao.value} value={String(opcao.value)}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Observações</Label>
          <Textarea
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            placeholder="Notas livres sobre o projeto — não entram em nenhum cálculo."
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar informações gerais"}
          </Button>
        </div>
      </CardContent>
    </Card>
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
    <Card className="rounded-[var(--radius-lg)]">
      <CardHeader>
        <CardTitle className="text-base">Taxas e Alíquota</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Alíquota Tributária Efetiva (%)</Label>
          <PercentInput value={form.aliquota} onChange={(fracao) => setForm({ ...form, aliquota: fracao })} placeholder="0,00" />
        </div>
        <div className="space-y-1.5">
          <Label>Taxa Mínima de Atratividade — TMA (%)</Label>
          <PercentInput
            value={form.tma}
            onChange={(fracao) => setForm({ ...form, tma: fracao })}
            placeholder="Vazio = não calcular VPL"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Taxa de Reinvestimento (%)</Label>
          <PercentInput
            value={form.reinvestimento}
            onChange={(fracao) => setForm({ ...form, reinvestimento: fracao })}
            placeholder="Vazio = não calcular TIRM"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Taxa de Custo de Captação (%)</Label>
          <PercentInput
            value={form.custoCaptacao}
            onChange={(fracao) => setForm({ ...form, custoCaptacao: fracao })}
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
  const [novaLinha, setNovaLinha] = useState({
    descricao: "",
    unidade_medida: "" as string,
    volumetria: "",
    valor_unitario: "",
    aliquota_especifica: "",
    mes_inicio: "",
    prazo_meses: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [linhaEditando, setLinhaEditando] = useState<LinhaReceita | null>(null);

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
        mes_inicio: novaLinha.mes_inicio ? Number(novaLinha.mes_inicio) : null,
        prazo_meses: novaLinha.prazo_meses ? Number(novaLinha.prazo_meses) : null,
        aliquota_especifica: novaLinha.aliquota_especifica || null,
      });
      setNovaLinha({
        descricao: "",
        unidade_medida: "",
        volumetria: "",
        valor_unitario: "",
        aliquota_especifica: "",
        mes_inicio: "",
        prazo_meses: "",
      });
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

  const totalCalculado = (data ?? []).reduce((soma, linha) => soma + Number(linha.valor_total_calculado || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="Linhas de Receita" value={formatNumber(data?.length ?? 0)} />
        <MetricCard label="Total Calculado" value={formatCurrency(totalCalculado)} secondary="Soma das linhas cadastradas" />
      </div>

      <TableContainer>
        <Table>
          <TableHeaderGold>
            <TableHead>Descrição</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead className="text-right">Volumetria</TableHead>
            <TableHead className="text-right">Valor Unitário</TableHead>
            <TableHead className="text-right">Impostos (%)</TableHead>
            <TableHead className="text-right">Mês Início</TableHead>
            <TableHead className="text-right">Prazo (meses)</TableHead>
            <TableHead className="text-right">Total Calculado</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableHeaderGold>
          <TableBody>
            {data?.map((linha) => (
              <TableRow key={linha.id}>
                <TableCell className="font-medium">
                  {linha.descricao}
                  {linha.bloqueado_por_origem ? (
                    <Badge variant="outline" className="ml-2">
                      Importada
                    </Badge>
                  ) : null}
                  {linha.bloqueado_por_override ? (
                    <Badge variant="outline" className="ml-2">
                      Distribuição manual
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>{linha.unidade_medida}</TableCell>
                <TableCell className="text-right">{formatNumber(linha.volumetria)}</TableCell>
                <TableCell className="text-right">{formatCurrency(linha.valor_unitario)}</TableCell>
                <TableCell className="text-right">
                  {linha.aliquota_especifica ? `${formatNumber(Number(linha.aliquota_especifica) * 100)}%` : "—"}
                </TableCell>
                <TableCell className="text-right">{linha.mes_inicio ?? "—"}</TableCell>
                <TableCell className="text-right">{linha.prazo_meses ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(linha.valor_total_calculado, { casasDecimais: 0 })}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setLinhaEditando(linha)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
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
                <TableCell colSpan={9}>
                  <EmptyState title="Nenhuma linha de receita cadastrada" />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

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
          <Select
            value={novaLinha.unidade_medida}
            onValueChange={(v) => v && setNovaLinha({ ...novaLinha, unidade_medida: v })}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {UNIDADES_MEDIDA.map((unidade) => (
                <SelectItem key={unidade} value={unidade}>
                  {unidade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Volumetria</Label>
          <Input
            className="w-28"
            value={novaLinha.volumetria}
            onChange={(e) => setNovaLinha({ ...novaLinha, volumetria: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valor Unitário</Label>
          <CurrencyInput
            className="w-32"
            value={novaLinha.valor_unitario}
            onChange={(valor) => setNovaLinha({ ...novaLinha, valor_unitario: valor })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Impostos (%)</Label>
          <PercentInput
            className="w-28"
            value={novaLinha.aliquota_especifica}
            onChange={(fracao) => setNovaLinha({ ...novaLinha, aliquota_especifica: fracao })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mês de Início</Label>
          <Input
            className="w-24"
            type="number"
            min={1}
            value={novaLinha.mes_inicio}
            onChange={(e) => setNovaLinha({ ...novaLinha, mes_inicio: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Prazo (meses)</Label>
          <Input
            className="w-24"
            type="number"
            min={1}
            value={novaLinha.prazo_meses}
            onChange={(e) => setNovaLinha({ ...novaLinha, prazo_meses: e.target.value })}
          />
        </div>
        <Button onClick={adicionar} disabled={salvando}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar linha
        </Button>
      </div>

      <EditarLinhaReceitaDialog
        versaoId={versaoId}
        linha={linhaEditando}
        onClose={() => setLinhaEditando(null)}
        onSalvo={refetch}
      />
    </div>
  );
}

function EditarLinhaReceitaDialog({
  versaoId,
  linha,
  onClose,
  onSalvo,
}: {
  versaoId: string;
  linha: LinhaReceita | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState({
    descricao: "",
    unidade_medida: "",
    volumetria: "",
    valor_unitario: "",
    aliquota_especifica: "" as string | null,
    mes_inicio: "",
    prazo_meses: "",
  });
  const [linhaCarregadaPara, setLinhaCarregadaPara] = useState<LinhaReceita | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Ajuste de estado durante a renderização (mesmo padrão de ParametrosGeraisForm)
  // — sincroniza o form com a linha selecionada para edição sem useEffect.
  if (linha && linha !== linhaCarregadaPara) {
    setLinhaCarregadaPara(linha);
    setForm({
      descricao: linha.descricao,
      unidade_medida: linha.unidade_medida,
      volumetria: linha.volumetria,
      valor_unitario: linha.valor_unitario,
      aliquota_especifica: linha.aliquota_especifica ?? "",
      mes_inicio: linha.mes_inicio != null ? String(linha.mes_inicio) : "",
      prazo_meses: linha.prazo_meses != null ? String(linha.prazo_meses) : "",
    });
  }

  async function salvar() {
    if (!linha) return;
    setSalvando(true);
    try {
      await viabilidadeApi.atualizarLinhaReceita(versaoId, linha.id, {
        descricao: form.descricao,
        unidade_medida: form.unidade_medida,
        volumetria: form.volumetria || "0",
        valor_unitario: form.valor_unitario || "0",
        aliquota_especifica: form.aliquota_especifica || null,
        mes_inicio: form.mes_inicio ? Number(form.mes_inicio) : null,
        prazo_meses: form.prazo_meses ? Number(form.prazo_meses) : null,
      });
      toast.success("Linha de receita atualizada.");
      onClose();
      onSalvo();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar a linha de receita.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={linha !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar linha de receita</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Unidade de Medida</Label>
              <Select
                value={form.unidade_medida}
                onValueChange={(v) => v && setForm({ ...form, unidade_medida: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_MEDIDA.map((unidade) => (
                    <SelectItem key={unidade} value={unidade}>
                      {unidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Impostos (%)</Label>
              <PercentInput
                value={form.aliquota_especifica}
                onChange={(fracao) => setForm({ ...form, aliquota_especifica: fracao })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Volumetria</Label>
              <Input
                disabled={linha?.bloqueado_por_origem || linha?.bloqueado_por_override}
                value={form.volumetria}
                onChange={(e) => setForm({ ...form, volumetria: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor Unitário</Label>
              <CurrencyInput
                disabled={linha?.bloqueado_por_origem}
                value={form.valor_unitario}
                onChange={(valor) => setForm({ ...form, valor_unitario: valor })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Mês de Início</Label>
              <Input
                type="number"
                min={1}
                value={form.mes_inicio}
                onChange={(e) => setForm({ ...form, mes_inicio: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo (meses)</Label>
              <Input
                type="number"
                min={1}
                disabled={linha?.bloqueado_por_origem || linha?.bloqueado_por_override}
                value={form.prazo_meses}
                onChange={(e) => setForm({ ...form, prazo_meses: e.target.value })}
              />
            </div>
          </div>

          {linha?.bloqueado_por_origem ? (
            <p className="text-xs text-muted-foreground">
              Volumetria, Valor Unitário e Prazo são importados de outro módulo e não podem ser alterados aqui.
            </p>
          ) : linha?.bloqueado_por_override ? (
            <p className="text-xs text-muted-foreground">
              Volumetria e Prazo têm distribuição manual por mês e não podem ser alterados aqui.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TabelaCusto({ versaoId }: { versaoId: string }) {
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.listarLinhasCusto(versaoId), [versaoId]);
  const [novaLinha, setNovaLinha] = useState({
    descricao: "",
    unidade_medida: "" as string,
    volumetria: "",
    custo_unitario: "",
    mes_inicio: "",
    prazo_meses: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [linhaEditando, setLinhaEditando] = useState<LinhaCusto | null>(null);

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
        mes_inicio: novaLinha.mes_inicio ? Number(novaLinha.mes_inicio) : null,
        prazo_meses: novaLinha.prazo_meses ? Number(novaLinha.prazo_meses) : null,
      });
      setNovaLinha({ descricao: "", unidade_medida: "", volumetria: "", custo_unitario: "", mes_inicio: "", prazo_meses: "" });
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

  const totalCalculado = (data ?? []).reduce((soma, linha) => soma + Number(linha.custo_total_calculado || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="Linhas de Custo" value={formatNumber(data?.length ?? 0)} />
        <MetricCard label="Total Calculado" value={formatCurrency(totalCalculado)} secondary="Soma das linhas cadastradas" />
      </div>

      <TableContainer>
        <Table>
          <TableHeaderGold>
            <TableHead>Descrição</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead className="text-right">Volumetria</TableHead>
            <TableHead className="text-right">Custo Unitário</TableHead>
            <TableHead className="text-right">Mês Início</TableHead>
            <TableHead className="text-right">Prazo (meses)</TableHead>
            <TableHead className="text-right">Total Calculado</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableHeaderGold>
          <TableBody>
            {data?.map((linha) => (
              <TableRow key={linha.id}>
                <TableCell className="font-medium">
                  {linha.descricao}
                  {linha.bloqueado_por_origem ? (
                    <Badge variant="outline" className="ml-2">
                      Importada
                    </Badge>
                  ) : null}
                  {linha.bloqueado_por_override ? (
                    <Badge variant="outline" className="ml-2">
                      Distribuição manual
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>{linha.unidade_medida}</TableCell>
                <TableCell className="text-right">{formatNumber(linha.volumetria)}</TableCell>
                <TableCell className="text-right">{formatCurrency(linha.custo_unitario)}</TableCell>
                <TableCell className="text-right">{linha.mes_inicio ?? "—"}</TableCell>
                <TableCell className="text-right">{linha.prazo_meses ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(linha.custo_total_calculado, { casasDecimais: 0 })}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setLinhaEditando(linha)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={linha.bloqueado_por_origem} onClick={() => excluir(linha.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data && data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState title="Nenhuma linha de custo cadastrada" />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

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
          <Select
            value={novaLinha.unidade_medida}
            onValueChange={(v) => v && setNovaLinha({ ...novaLinha, unidade_medida: v })}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {UNIDADES_MEDIDA.map((unidade) => (
                <SelectItem key={unidade} value={unidade}>
                  {unidade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Volumetria</Label>
          <Input
            className="w-28"
            value={novaLinha.volumetria}
            onChange={(e) => setNovaLinha({ ...novaLinha, volumetria: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Custo Unitário</Label>
          <CurrencyInput
            className="w-32"
            value={novaLinha.custo_unitario}
            onChange={(valor) => setNovaLinha({ ...novaLinha, custo_unitario: valor })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mês de Início</Label>
          <Input
            className="w-24"
            type="number"
            min={1}
            value={novaLinha.mes_inicio}
            onChange={(e) => setNovaLinha({ ...novaLinha, mes_inicio: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Prazo (meses)</Label>
          <Input
            className="w-24"
            type="number"
            min={1}
            value={novaLinha.prazo_meses}
            onChange={(e) => setNovaLinha({ ...novaLinha, prazo_meses: e.target.value })}
          />
        </div>
        <Button onClick={adicionar} disabled={salvando}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar linha
        </Button>
      </div>

      <EditarLinhaCustoDialog
        versaoId={versaoId}
        linha={linhaEditando}
        onClose={() => setLinhaEditando(null)}
        onSalvo={refetch}
      />
    </div>
  );
}

function EditarLinhaCustoDialog({
  versaoId,
  linha,
  onClose,
  onSalvo,
}: {
  versaoId: string;
  linha: LinhaCusto | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState({
    descricao: "",
    unidade_medida: "",
    volumetria: "",
    custo_unitario: "",
    mes_inicio: "",
    prazo_meses: "",
  });
  const [linhaCarregadaPara, setLinhaCarregadaPara] = useState<LinhaCusto | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (linha && linha !== linhaCarregadaPara) {
    setLinhaCarregadaPara(linha);
    setForm({
      descricao: linha.descricao,
      unidade_medida: linha.unidade_medida,
      volumetria: linha.volumetria,
      custo_unitario: linha.custo_unitario,
      mes_inicio: linha.mes_inicio != null ? String(linha.mes_inicio) : "",
      prazo_meses: linha.prazo_meses != null ? String(linha.prazo_meses) : "",
    });
  }

  async function salvar() {
    if (!linha) return;
    setSalvando(true);
    try {
      await viabilidadeApi.atualizarLinhaCusto(versaoId, linha.id, {
        descricao: form.descricao,
        unidade_medida: form.unidade_medida,
        volumetria: form.volumetria || "0",
        custo_unitario: form.custo_unitario || "0",
        mes_inicio: form.mes_inicio ? Number(form.mes_inicio) : null,
        prazo_meses: form.prazo_meses ? Number(form.prazo_meses) : null,
      });
      toast.success("Linha de custo atualizada.");
      onClose();
      onSalvo();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar a linha de custo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={linha !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar linha de custo</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Unidade de Medida</Label>
              <Select
                value={form.unidade_medida}
                onValueChange={(v) => v && setForm({ ...form, unidade_medida: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_MEDIDA.map((unidade) => (
                    <SelectItem key={unidade} value={unidade}>
                      {unidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Volumetria</Label>
              <Input
                disabled={linha?.bloqueado_por_origem || linha?.bloqueado_por_override}
                value={form.volumetria}
                onChange={(e) => setForm({ ...form, volumetria: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Custo Unitário</Label>
              <CurrencyInput
                disabled={linha?.bloqueado_por_origem}
                value={form.custo_unitario}
                onChange={(valor) => setForm({ ...form, custo_unitario: valor })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mês de Início</Label>
              <Input
                type="number"
                min={1}
                value={form.mes_inicio}
                onChange={(e) => setForm({ ...form, mes_inicio: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Prazo (meses)</Label>
              <Input
                type="number"
                min={1}
                disabled={linha?.bloqueado_por_origem || linha?.bloqueado_por_override}
                value={form.prazo_meses}
                onChange={(e) => setForm({ ...form, prazo_meses: e.target.value })}
              />
            </div>
          </div>

          {linha?.bloqueado_por_origem ? (
            <p className="text-xs text-muted-foreground">
              Volumetria, Custo Unitário e Prazo são importados de outro módulo e não podem ser alterados aqui.
            </p>
          ) : linha?.bloqueado_por_override ? (
            <p className="text-xs text-muted-foreground">
              Volumetria e Prazo têm distribuição manual por mês e não podem ser alterados aqui.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const RECEITA_BRUTA_TOTAL = "__receita_bruta_total__";

function TabelaDespesas({ versaoId }: { versaoId: string }) {
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.listarDespesas(versaoId), [versaoId]);
  const { data: linhasReceita } = useApiResource(() => viabilidadeApi.listarLinhasReceita(versaoId), [versaoId]);
  const [novaDespesa, setNovaDespesa] = useState<{
    descricao: string;
    tipo: DespesaTipo;
    percentual: string;
    linhaReceitaReferenciaId: string;
  }>({
    descricao: "",
    tipo: "despesa",
    percentual: "",
    linhaReceitaReferenciaId: RECEITA_BRUTA_TOTAL,
  });
  const [salvando, setSalvando] = useState(false);
  const [despesaEditando, setDespesaEditando] = useState<DespesaNaoOperacional | null>(null);

  function nomeDaLinhaReferencia(linhaId: string | null): string {
    if (!linhaId) return "Receita Bruta Total";
    return linhasReceita?.find((linha) => linha.id === linhaId)?.descricao ?? "Linha removida";
  }

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
        linha_receita_referencia_id:
          novaDespesa.linhaReceitaReferenciaId === RECEITA_BRUTA_TOTAL ? null : novaDespesa.linhaReceitaReferenciaId,
      });
      setNovaDespesa({ descricao: "", tipo: "despesa", percentual: "", linhaReceitaReferenciaId: RECEITA_BRUTA_TOTAL });
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

  const despesas = (data ?? []).filter((d) => d.tipo === "despesa").length;
  const recuperacoes = (data ?? []).filter((d) => d.tipo === "recuperacao").length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Sem referência a uma linha de Receita, o percentual é aplicado sobre a Receita Bruta Total do projeto. A linha
        de Custo Financeiro é automática e não aparece aqui — é derivada da Taxa de Custo de Captação.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="Despesas" value={formatNumber(despesas)} secondary="Reduzem o resultado" />
        <MetricCard label="Recuperações" value={formatNumber(recuperacoes)} secondary="Aumentam o resultado" />
      </div>

      <TableContainer>
        <Table>
          <TableHeaderGold>
            <TableHead>Descrição</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Percentual</TableHead>
            <TableHead>Linha de Receita de Referência</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableHeaderGold>
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
                <TableCell>
                  {despesa.linha_receita_referencia_id ? (
                    <Badge variant="outline">{nomeDaLinhaReferencia(despesa.linha_receita_referencia_id)}</Badge>
                  ) : (
                    <span className="text-muted-foreground">Receita Bruta Total</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setDespesaEditando(despesa)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => excluir(despesa.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data && data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState title="Nenhuma despesa não operacional cadastrada" />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

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
          <Label className="text-xs">Percentual (%)</Label>
          <PercentInput
            className="w-32"
            value={novaDespesa.percentual}
            onChange={(fracao) => setNovaDespesa({ ...novaDespesa, percentual: fracao })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Linha de Receita de Referência</Label>
          <Select
            value={novaDespesa.linhaReceitaReferenciaId}
            onValueChange={(v) => v && setNovaDespesa({ ...novaDespesa, linhaReceitaReferenciaId: v })}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={RECEITA_BRUTA_TOTAL}>Receita Bruta Total</SelectItem>
              {linhasReceita?.map((linha) => (
                <SelectItem key={linha.id} value={linha.id}>
                  {linha.descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={adicionar} disabled={salvando}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar despesa
        </Button>
      </div>

      <EditarDespesaDialog
        versaoId={versaoId}
        despesa={despesaEditando}
        linhasReceita={linhasReceita ?? []}
        onClose={() => setDespesaEditando(null)}
        onSalvo={refetch}
      />
    </div>
  );
}

function EditarDespesaDialog({
  versaoId,
  despesa,
  linhasReceita,
  onClose,
  onSalvo,
}: {
  versaoId: string;
  despesa: DespesaNaoOperacional | null;
  linhasReceita: LinhaReceita[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState({
    descricao: "",
    tipo: "despesa" as DespesaTipo,
    percentual: "",
    linhaReceitaReferenciaId: RECEITA_BRUTA_TOTAL,
  });
  const [despesaCarregadaPara, setDespesaCarregadaPara] = useState<DespesaNaoOperacional | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (despesa && despesa !== despesaCarregadaPara) {
    setDespesaCarregadaPara(despesa);
    setForm({
      descricao: despesa.descricao,
      tipo: despesa.tipo,
      percentual: despesa.percentual,
      linhaReceitaReferenciaId: despesa.linha_receita_referencia_id ?? RECEITA_BRUTA_TOTAL,
    });
  }

  async function salvar() {
    if (!despesa) return;
    setSalvando(true);
    try {
      await viabilidadeApi.atualizarDespesa(versaoId, despesa.id, {
        descricao: form.descricao,
        tipo: form.tipo,
        percentual: form.percentual || "0",
        linha_receita_referencia_id:
          form.linhaReceitaReferenciaId === RECEITA_BRUTA_TOTAL ? null : form.linhaReceitaReferenciaId,
      });
      toast.success("Despesa atualizada.");
      onClose();
      onSalvo();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar a despesa.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={despesa !== null} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar despesa não operacional</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => v && setForm({ ...form, tipo: v as DespesaTipo })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="recuperacao">Recuperação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Percentual (%)</Label>
              <PercentInput value={form.percentual} onChange={(fracao) => setForm({ ...form, percentual: fracao })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Linha de Receita de Referência</Label>
            <Select
              value={form.linhaReceitaReferenciaId}
              onValueChange={(v) => v && setForm({ ...form, linhaReceitaReferenciaId: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={RECEITA_BRUTA_TOTAL}>Receita Bruta Total</SelectItem>
                {linhasReceita.map((linha) => (
                  <SelectItem key={linha.id} value={linha.id}>
                    {linha.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
