"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/finance/states";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import { ApiError } from "@/lib/api/client";

/** Lista/gerencia as versões de um contrato — criar, renomear, duplicar, excluir. */
export function HistoricoVersoes({ contratoId, versaoAtualId }: { contratoId: string; versaoAtualId: string }) {
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
