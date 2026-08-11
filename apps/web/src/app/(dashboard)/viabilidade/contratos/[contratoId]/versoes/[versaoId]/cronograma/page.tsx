"use client";

import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MonthTableHead } from "@/components/finance/month-table-head";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/finance/states";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import { ApiError } from "@/lib/api/client";
import type { CelulaCronograma, CronogramaResponse, LinhaCronograma } from "@/lib/types/viabilidade";

type AbaCronograma = "receita" | "custo";

const ABAS_CRONOGRAMA: { label: string; value: AbaCronograma }[] = [
  { label: "Receita", value: "receita" },
  { label: "Custo", value: "custo" },
];

/**
 * PRD Tela 3 — única tela onde a distribuição temporal de Volumetria é editada.
 * Nota de escopo: como esta tela permite edição direta (overrides célula a célula),
 * o Seletor de Versão global (layout.tsx) deveria bloquear a troca de versão com
 * confirmação de alterações não salvas (PRD Tela 2, seção 2b). As edições ficam em
 * estado local (rascunho) e só são persistidas em lote ao clicar em "Salvar
 * Cronograma" — sem recálculo/round-trip por célula.
 */
export default function CronogramaPage() {
  const { contratoId, versaoId } = useParams<{ contratoId: string; versaoId: string }>();
  const [aba, setAba] = useState<AbaCronograma>("receita");
  const { data: contrato } = useApiResource(() => viabilidadeApi.obterContrato(contratoId), [contratoId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gold-gradient font-[var(--font-display)] text-2xl font-bold">
          Cronograma Físico-Financeiro
        </h1>
        <p className="text-sm text-muted-foreground">
          Distribuição da Volumetria ao longo do tempo — linear por padrão, editável célula a célula.
        </p>
      </div>

      <SegmentedControl options={ABAS_CRONOGRAMA} value={aba} onChange={setAba} />

      <div className="pt-2">
        <CronogramaTabela versaoId={versaoId} tipo={aba} dataInicio={contrato?.data_inicio} />
      </div>
    </div>
  );
}

const REPLICAR_REGEX = /^=(-?\d+(?:[.,]\d+)?)>$/;

function CronogramaTabela({
  versaoId,
  tipo,
  dataInicio,
}: {
  versaoId: string;
  tipo: "receita" | "custo";
  dataInicio: string | undefined;
}) {
  const { data, loading, error, refetch } = useApiResource<CronogramaResponse>(
    () => (tipo === "receita" ? viabilidadeApi.obterCronogramaReceita(versaoId) : viabilidadeApi.obterCronogramaCusto(versaoId)),
    [versaoId, tipo]
  );
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function definirValor(linhaId: string, mes: number, valor: string) {
    const chave = `${linhaId}-${mes}`;
    setEditando((prev) => ({ ...prev, [chave]: valor }));
    const input = inputRefs.current[chave];
    if (input) input.value = valor;
  }

  function handleChange(linha: LinhaCronograma, celula: CelulaCronograma, valorDigitado: string) {
    const match = valorDigitado.match(REPLICAR_REGEX);
    if (match) {
      const valorReplicado = match[1];
      linha.celulas
        .filter((c) => c.dentro_da_janela && c.mes >= celula.mes)
        .forEach((c) => definirValor(linha.linha_id, c.mes, valorReplicado));
      return;
    }
    definirValor(linha.linha_id, celula.mes, valorDigitado);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, linha: LinhaCronograma, celula: CelulaCronograma) {
    const texto = e.clipboardData.getData("text");
    const valores = texto.split(/[\t\s]+/).map((v) => v.trim()).filter(Boolean);
    if (valores.length <= 1) return;
    e.preventDefault();

    const celulasAlvo = linha.celulas.filter((c) => c.dentro_da_janela && c.mes >= celula.mes);
    valores.forEach((valor, i) => {
      const alvo = celulasAlvo[i];
      if (alvo) definirValor(linha.linha_id, alvo.mes, valor);
    });
  }

  async function salvarCronograma() {
    if (!data) return;
    const linhasComEdicao = data.linhas
      .map((linha) => {
        const celulas = linha.celulas
          .filter((c) => editando[`${linha.linha_id}-${c.mes}`] !== undefined)
          .map((c) => ({ mes: c.mes, volumetria: editando[`${linha.linha_id}-${c.mes}`] }));
        return { linhaId: linha.linha_id, celulas };
      })
      .filter((l) => l.celulas.length > 0);

    if (linhasComEdicao.length === 0) return;

    setSalvando(true);
    try {
      await Promise.all(
        linhasComEdicao.map((l) =>
          tipo === "receita"
            ? viabilidadeApi.atualizarCelulasReceita(versaoId, l.linhaId, l.celulas)
            : viabilidadeApi.atualizarCelulasCusto(versaoId, l.linhaId, l.celulas)
        )
      );
      toast.success("Cronograma salvo.");
      setEditando({});
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar o cronograma.");
    } finally {
      setSalvando(false);
    }
  }

  async function resetarLinha(linhaId: string) {
    if (!confirm("Isso vai limpar todos os overrides manuais desta linha e voltar à distribuição linear. Continuar?")) return;
    try {
      if (tipo === "receita") {
        await viabilidadeApi.resetarDistribuicaoReceita(versaoId, linhaId);
      } else {
        await viabilidadeApi.resetarDistribuicaoCusto(versaoId, linhaId);
      }
      toast.success("Distribuição resetada.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível resetar a distribuição.");
    }
  }

  if (loading) return <LoadingState rows={4} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data || data.linhas.length === 0) {
    return <EmptyState title={`Nenhuma linha de ${tipo} cadastrada`} description="Cadastre linhas na aba Parâmetros primeiro." />;
  }

  const temEdicoes = Object.keys(editando).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={salvarCronograma} disabled={!temEdicoes || salvando}>
          <Save className="mr-1.5 h-4 w-4" />
          {salvando ? "Salvando..." : "Salvar Cronograma"}
        </Button>
      </div>
      {data.linhas.map((linha) => (
        <div key={linha.linha_id} className="overflow-hidden rounded-[var(--radius-lg)] border border-border/60">
          <div className="flex items-center justify-between gap-4 border-b border-border/60 bg-card/40 px-4 py-2">
            <div className="flex items-center gap-2">
              <p className="font-medium">{linha.descricao}</p>
              {linha.divergente ? (
                <Badge variant="destructive" className="font-mono text-[0.6rem] uppercase tracking-wider">
                  Soma diverge do total
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Total: <span className="text-foreground">{formatNumber(linha.total_linha)}</span> · Distribuído:{" "}
                <span className="text-foreground">{formatNumber(linha.soma_distribuicao)}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => resetarLinha(linha.linha_id)}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Resetar
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Totalizador</TableHead>
                  {data.meses.map((mes) => (
                    <MonthTableHead key={mes} mes={mes} dataInicio={dataInicio} className="text-center" />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="bg-muted/40 p-1 text-center">
                    <p className="font-medium">{formatNumber(linha.total_linha)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(
                        linha.celulas.reduce((soma, c) => soma + Number(c.valor_calculado ?? 0), 0),
                        { casasDecimais: 0 }
                      )}
                    </p>
                  </TableCell>
                  {linha.celulas.map((celula) => {
                    const chave = `${linha.linha_id}-${celula.mes}`;
                    if (!celula.dentro_da_janela) {
                      return (
                        <TableCell key={celula.mes} className="bg-muted/40 text-center text-muted-foreground">
                          —
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={celula.mes} className="p-1 text-center">
                        <Input
                          ref={(el) => {
                            inputRefs.current[chave] = el;
                          }}
                          className={`h-8 w-20 text-center ${celula.is_override ? "border-primary/50" : ""}`}
                          defaultValue={celula.volumetria ?? "0"}
                          onChange={(e) => handleChange(linha, celula, e.target.value)}
                          onPaste={(e) => handlePaste(e, linha, celula)}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(celula.valor_calculado, { casasDecimais: 0 })}
                        </p>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
