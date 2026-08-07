"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import type { ContratoCreatePayload } from "@/lib/types/viabilidade";

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

interface NovoProjetoDialogProps {
  /** Trigger customizado (ex: item de menu). Padrão: botão "Novo projeto". Passe `null` para controle 100% externo via open/onOpenChange (ex: CTA de empty state). */
  trigger?: React.ReactElement | null;
  onCriado?: () => void;
  /** Estado controlado externamente — usado pelo CTA de empty state, que já tem seu próprio botão de disparo. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Diálogo de criação de projeto — extraído de viabilidade/page.tsx para ser
 * reutilizável no cabeçalho global (Header) além da própria lista de projetos.
 */
export function NovoProjetoDialog({ trigger, onCriado, open, onOpenChange }: NovoProjetoDialogProps) {
  const router = useRouter();
  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = open ?? abertoInterno;
  const setAberto = onOpenChange ?? setAbertoInterno;
  const [salvando, setSalvando] = useState(false);
  const [campos, setCampos] = useState<ContratoCreatePayload>(CAMPOS_INICIAIS);

  async function handleCriarProjeto() {
    setSalvando(true);
    try {
      const contrato = await viabilidadeApi.criarContrato(campos);
      toast.success("Projeto criado com sucesso.");
      setAberto(false);
      setCampos(CAMPOS_INICIAIS);
      onCriado?.();
      router.push(`/viabilidade/contratos/${contrato.id}/versoes/${contrato.versao_inicial_id}/parametros`);
    } catch (err) {
      // Sempre a mensagem EXATA vinda da API (ou do erro em si) — nunca um texto
      // fixo genérico, que escondia qual campo/regra causou a rejeição.
      console.error("ERRO FATAL CRIAR PROJETO:", err, { payloadEnviado: campos });
      const mensagem = err instanceof Error ? err.message : "Não foi possível criar o projeto.";
      toast.error(mensagem);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      {trigger !== null ? (
        <DialogTrigger
          render={
            trigger ?? (
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Novo projeto
              </Button>
            )
          }
        />
      ) : null}
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
          <Button variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCriarProjeto} disabled={salvando}>
            {salvando ? "Criando..." : "Criar projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
