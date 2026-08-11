"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { TableContainer, TableHeaderGold } from "@/components/ui/table-container";
import { EmptyState, ErrorState, LoadingState } from "@/components/finance/states";
import { NovoProjetoDialog } from "@/components/viabilidade/novo-projeto-dialog";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { StatusCicloVida } from "@/lib/types/viabilidade";

/** Funil comercial da Tela 1 — opções oferecidas na edição de status. Valores legados
 * (contrato_assinado/em_execucao/encerrado/cancelado) não aparecem aqui: só existem no
 * enum para não invalidar linhas antigas, mas não são mais um destino válido de edição. */
const STATUS_OPCOES: { value: StatusCicloVida; label: string }[] = [
  { value: "em_prospeccao", label: "Em prospecção" },
  { value: "em_elaboracao", label: "Em elaboração" },
  { value: "proposta_enviada", label: "Proposta enviada" },
  { value: "em_negociacao", label: "Em negociação" },
  { value: "aprovado_fechado", label: "Aprovado/Fechado" },
  { value: "perdido_cancelado", label: "Perdido/Cancelado" },
];

const STATUS_LABELS: Record<StatusCicloVida, string> = {
  em_prospeccao: "Em prospecção",
  em_elaboracao: "Em elaboração",
  proposta_enviada: "Proposta enviada",
  em_negociacao: "Em negociação",
  aprovado_fechado: "Aprovado/Fechado",
  perdido_cancelado: "Perdido/Cancelado",
  // Legado — ver StatusCicloVida em lib/types/viabilidade.ts.
  contrato_assinado: "Contrato assinado",
  em_execucao: "Em execução",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

/** Cor distinta por estágio do funil — cinza/azul nos estágios iniciais, dourado nos
 * intermediários (proposta/negociação), verde no fechamento, vermelho na perda. Estados
 * legados caem no cinza neutro (não são mais alcançáveis pela UI, só exibição de dados antigos). */
const STATUS_CLASSES: Record<StatusCicloVida, string> = {
  em_prospeccao: "border-slate-500/40 bg-slate-500/15 text-slate-300",
  em_elaboracao: "border-sky-500/40 bg-sky-500/15 text-sky-400",
  proposta_enviada: "border-primary/40 bg-primary/15 text-primary",
  em_negociacao: "border-primary/60 bg-primary/25 text-primary",
  aprovado_fechado: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  perdido_cancelado: "border-destructive/40 bg-destructive/15 text-destructive",
  contrato_assinado: "border-slate-500/40 bg-slate-500/15 text-slate-300",
  em_execucao: "border-slate-500/40 bg-slate-500/15 text-slate-300",
  encerrado: "border-slate-500/40 bg-slate-500/15 text-slate-300",
  cancelado: "border-destructive/40 bg-destructive/15 text-destructive",
};

export default function ProjetosPage() {
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [salvandoStatusId, setSalvandoStatusId] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApiResource(
    () =>
      viabilidadeApi
        .listarContratos({ mostrar_arquivados: mostrarArquivados, page_size: 100 })
        .catch((err) => {
          console.error("ERRO FATAL FETCH PROJETOS:", err);
          throw err;
        }),
    [mostrarArquivados]
  );

  async function handleArquivar(contratoId: string, jaArquivado: boolean) {
    try {
      if (jaArquivado) {
        await viabilidadeApi.desarquivarContrato(contratoId);
        toast.success("Projeto desarquivado.");
      } else {
        const resultado = await viabilidadeApi.arquivarContrato(contratoId);
        toast.success(
          resultado.modulos_afetados.length > 1
            ? `Projeto arquivado em todos os módulos vinculados: ${resultado.modulos_afetados.join(", ")}.`
            : "Projeto arquivado."
        );
      }
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível concluir a ação.");
    }
  }

  async function handleAlterarStatus(contratoId: string, novoStatus: StatusCicloVida) {
    setSalvandoStatusId(contratoId);
    try {
      await viabilidadeApi.atualizarContrato(contratoId, { status_ciclo_vida: novoStatus });
      toast.success("Status do projeto atualizado.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar o status do projeto.");
    } finally {
      setSalvandoStatusId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-gold-gradient font-[var(--font-display)] text-2xl font-bold">
            Cadastro e Consulta de Projetos
          </h1>
          <p className="text-sm text-muted-foreground">
            Contratos mestre compartilhados entre Viabilidade, Precificação e Gestão.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMostrarArquivados((v) => !v)}>
            {mostrarArquivados ? "Ocultar arquivados" : "Mostrar arquivados"}
          </Button>

          <NovoProjetoDialog onCriado={refetch} />
        </div>
      </div>

      {loading ? <LoadingState rows={5} /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {!loading && !error && data && data.items.length === 0 ? (
        <>
          <EmptyState
            title="Nenhum projeto cadastrado"
            description="Crie o primeiro projeto para começar a análise de viabilidade."
            action={
              <Button onClick={() => setDialogAberto(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Cadastre seu primeiro projeto
              </Button>
            }
          />
          <NovoProjetoDialog trigger={null} open={dialogAberto} onOpenChange={setDialogAberto} onCriado={refetch} />
        </>
      ) : null}

      {!loading && !error && data && data.items.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHeaderGold>
              <TableHead>Nome do Projeto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Módulos Vinculados</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableHeaderGold>
            <TableBody>
              {data.items.map((contrato) => (
                <TableRow key={contrato.id} className={contrato.arquivado ? "opacity-60" : undefined}>
                  <TableCell className="font-medium">
                    <Link href={`/viabilidade/contratos/${contrato.id}`} className="hover:text-primary hover:underline">
                      {contrato.nome_projeto}
                    </Link>
                  </TableCell>
                  <TableCell>{contrato.cliente}</TableCell>
                  <TableCell>
                    <Select
                      value={contrato.status_ciclo_vida}
                      onValueChange={(v) => v && handleAlterarStatus(contrato.id, v as StatusCicloVida)}
                    >
                      <SelectTrigger
                        size="sm"
                        disabled={salvandoStatusId === contrato.id}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          STATUS_CLASSES[contrato.status_ciclo_vida]
                        )}
                      >
                        <SelectValue>{STATUS_LABELS[contrato.status_ciclo_vida]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPCOES.map((opcao) => (
                          <SelectItem key={opcao.value} value={opcao.value}>
                            {opcao.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="border-primary/40 text-primary">
                        Viabilidade
                      </Badge>
                      {contrato.modulos_vinculados.map((modulo) => (
                        <Badge key={modulo} variant="outline">
                          {modulo === "precificacao" ? "Precificação" : "Gestão"}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(contrato.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArquivar(contrato.id, contrato.arquivado)}
                    >
                      {contrato.arquivado ? (
                        <ArchiveRestore className="mr-1 h-4 w-4" />
                      ) : (
                        <Archive className="mr-1 h-4 w-4" />
                      )}
                      {contrato.arquivado ? "Desarquivar" : "Arquivar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </div>
  );
}
