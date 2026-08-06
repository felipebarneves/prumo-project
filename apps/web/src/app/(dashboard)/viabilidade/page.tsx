"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/finance/states";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import { ApiError } from "@/lib/api/client";
import type { ContratoCreatePayload, StatusCicloVida } from "@/lib/types/viabilidade";

const STATUS_LABELS: Record<StatusCicloVida, string> = {
  em_prospeccao: "Em prospecção",
  contrato_assinado: "Contrato assinado",
  em_execucao: "Em execução",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

const CAMPOS_INICIAIS: ContratoCreatePayload = {
  nome_projeto: "",
  cliente: "",
  data_inicio: new Date().toISOString().slice(0, 10),
  duracao_meses: 12,
  nome_contrato: "",
  prazo_pagamento_dias: 30,
  nome_versao: "Versão inicial",
  regime_tributario: "lucro_presumido",
};

export default function ProjetosPage() {
  const router = useRouter();
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [campos, setCampos] = useState<ContratoCreatePayload>(CAMPOS_INICIAIS);

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

  async function handleCriarProjeto() {
    setSalvando(true);
    try {
      const contrato = await viabilidadeApi.criarContrato(campos);
      toast.success("Projeto criado com sucesso.");
      setDialogAberto(false);
      setCampos(CAMPOS_INICIAIS);
      router.push(`/viabilidade/contratos/${contrato.id}/versoes/${contrato.versao_inicial_id}/parametros`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Não foi possível criar o projeto.");
      }
    } finally {
      setSalvando(false);
    }
  }

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cadastro e Consulta de Projetos</h1>
          <p className="text-sm text-muted-foreground">
            Contratos mestre compartilhados entre Viabilidade, Precificação e Gestão.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMostrarArquivados((v) => !v)}>
            {mostrarArquivados ? "Ocultar arquivados" : "Mostrar arquivados"}
          </Button>

          <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
            <DialogTrigger
              render={
                <Button>
                  <Plus className="mr-1 h-4 w-4" />
                  Novo projeto
                </Button>
              }
            />
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo projeto</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome_projeto">Nome do Projeto</Label>
                    <Input
                      id="nome_projeto"
                      value={campos.nome_projeto}
                      onChange={(e) => setCampos({ ...campos, nome_projeto: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cliente">Cliente</Label>
                    <Input
                      id="cliente"
                      value={campos.cliente}
                      onChange={(e) => setCampos({ ...campos, cliente: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="data_inicio">Data de Início</Label>
                    <Input
                      id="data_inicio"
                      type="date"
                      value={campos.data_inicio}
                      onChange={(e) => setCampos({ ...campos, data_inicio: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="duracao_meses">Duração (meses)</Label>
                    <Input
                      id="duracao_meses"
                      type="number"
                      min={1}
                      value={campos.duracao_meses || ""}
                      onChange={(e) => {
                        const valor = e.target.value;
                        setCampos({ ...campos, duracao_meses: valor === "" ? 0 : Number(valor) });
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nome_contrato">Descrição do Projeto</Label>
                  <Input
                    id="nome_contrato"
                    value={campos.nome_contrato}
                    onChange={(e) => setCampos({ ...campos, nome_contrato: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Prazo de Pagamento</Label>
                    <Select
                      value={String(campos.prazo_pagamento_dias)}
                      onValueChange={(v) => v && setCampos({ ...campos, prazo_pagamento_dias: Number(v) as 30 | 60 | 90 })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 dias</SelectItem>
                        <SelectItem value="60">60 dias</SelectItem>
                        <SelectItem value="90">90 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Regime Tributário</Label>
                    <Select
                      value={campos.regime_tributario}
                      onValueChange={(v) =>
                        v && setCampos({ ...campos, regime_tributario: v as ContratoCreatePayload["regime_tributario"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Imutável após a criação do projeto.</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nome_versao">Nome da Versão</Label>
                  <Input
                    id="nome_versao"
                    value={campos.nome_versao}
                    onChange={(e) => setCampos({ ...campos, nome_versao: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogAberto(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCriarProjeto} disabled={salvando}>
                  {salvando ? "Criando..." : "Criar projeto"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? <LoadingState rows={5} /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {!loading && !error && data && data.items.length === 0 ? (
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
      ) : null}

      {!loading && !error && data && data.items.length > 0 ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Projeto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Módulos Vinculados</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
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
                    <Badge variant="secondary">{STATUS_LABELS[contrato.status_ciclo_vida]}</Badge>
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
        </div>
      ) : null}
    </div>
  );
}
