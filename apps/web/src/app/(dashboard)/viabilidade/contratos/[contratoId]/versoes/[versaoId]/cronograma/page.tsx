"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/finance/states";
import { formatNumber } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import { ApiError } from "@/lib/api/client";
import type { CronogramaResponse } from "@/lib/types/viabilidade";

/**
 * PRD Tela 3 — única tela onde a distribuição temporal de Volumetria é editada.
 * Nota de escopo: como esta tela permite edição direta (overrides célula a célula),
 * o Seletor de Versão global (layout.tsx) deveria bloquear a troca de versão com
 * confirmação de alterações não salvas (PRD Tela 2, seção 2b). Esta entrega grava
 * cada célula imediatamente ao perder o foco (sem estado de "rascunho" local), o
 * que já elimina o risco de perda de dado — a confirmação explícita fica como
 * refinamento futuro caso o padrão de edição mude para "salvar em lote".
 */
export default function CronogramaPage() {
  const { versaoId } = useParams<{ versaoId: string }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cronograma Físico-Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Distribuição da Volumetria ao longo do tempo — linear por padrão, editável célula a célula.
        </p>
      </div>

      <Tabs defaultValue="receita">
        <TabsList>
          <TabsTrigger value="receita">Receita</TabsTrigger>
          <TabsTrigger value="custo">Custo</TabsTrigger>
        </TabsList>
        <TabsContent value="receita" className="pt-4">
          <CronogramaTabela versaoId={versaoId} tipo="receita" />
        </TabsContent>
        <TabsContent value="custo" className="pt-4">
          <CronogramaTabela versaoId={versaoId} tipo="custo" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CronogramaTabela({ versaoId, tipo }: { versaoId: string; tipo: "receita" | "custo" }) {
  const { data, loading, error, refetch } = useApiResource<CronogramaResponse>(
    () => (tipo === "receita" ? viabilidadeApi.obterCronogramaReceita(versaoId) : viabilidadeApi.obterCronogramaCusto(versaoId)),
    [versaoId, tipo]
  );
  const [editando, setEditando] = useState<Record<string, string>>({});

  async function salvarCelula(linhaId: string, mes: number) {
    const chave = `${linhaId}-${mes}`;
    const valor = editando[chave];
    if (valor === undefined) return;

    try {
      if (tipo === "receita") {
        await viabilidadeApi.atualizarCelulasReceita(versaoId, linhaId, [{ mes, volumetria: valor }]);
      } else {
        await viabilidadeApi.atualizarCelulasCusto(versaoId, linhaId, [{ mes, volumetria: valor }]);
      }
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar a célula.");
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

  return (
    <div className="space-y-6">
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
                  {data.meses.map((mes) => (
                    <TableHead key={mes} className="text-center">
                      {mes}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
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
                          className={`h-8 w-20 text-center ${celula.is_override ? "border-primary/50" : ""}`}
                          defaultValue={celula.volumetria ?? "0"}
                          onChange={(e) => setEditando((prev) => ({ ...prev, [chave]: e.target.value }))}
                          onBlur={() => salvarCelula(linha.linha_id, celula.mes)}
                        />
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
