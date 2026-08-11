"use client";

import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { TableContainer, TableHeaderGold } from "@/components/ui/table-container";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { MetricCard } from "@/components/finance/metric-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/finance/states";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";
import { ApiError } from "@/lib/api/client";
import type { OrganizationRole, PlanTier, SubscriptionStatus } from "@/lib/types/viabilidade";

type AbaConfiguracoes = "dados" | "membros" | "assinatura";

const ABAS: { label: string; value: AbaConfiguracoes }[] = [
  { label: "Dados da Organização", value: "dados" },
  { label: "Membros e Permissões", value: "membros" },
  { label: "Assinatura e Plano", value: "assinatura" },
];

const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  starter: "Starter",
  pro_planejamento: "Pro Planejamento",
  pro_execucao: "Pro Execução",
  master: "Master",
};

const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Ativa",
  past_due: "Pagamento pendente",
  inactive: "Inativa",
};

const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  executor: "Executor",
  viewer: "Viewer",
};

export default function ConfiguracoesPage() {
  const [aba, setAba] = useState<AbaConfiguracoes>("dados");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-gold-gradient font-[var(--font-display)] text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da organização, membros e assinatura do plano Prumo.</p>
      </div>

      <SegmentedControl options={ABAS} value={aba} onChange={setAba} />

      {aba === "dados" ? <DadosOrganizacao /> : null}
      {aba === "membros" ? <MembrosPermissoes /> : null}
      {aba === "assinatura" ? <AssinaturaPlano /> : null}
    </div>
  );
}

function DadosOrganizacao() {
  const { data, loading, error, refetch } = useApiResource(
    () => viabilidadeApi.obterConfiguracoesOrganizacao(),
    []
  );
  const [form, setForm] = useState({ name: "", document_id: "" });
  const [dadosCarregadosPara, setDadosCarregadosPara] = useState<typeof data>(null);
  const [salvando, setSalvando] = useState(false);

  // Ajuste de estado durante a renderização (mesmo padrão de ParametrosGeraisForm)
  // — sincroniza o form com os dados assíncronos sem useEffect.
  if (data && data !== dadosCarregadosPara) {
    setDadosCarregadosPara(data);
    setForm({ name: data.name, document_id: data.document_id ?? "" });
  }

  async function salvar() {
    if (!form.name.trim()) {
      toast.error("Informe o nome da organização.");
      return;
    }
    setSalvando(true);
    try {
      await viabilidadeApi.atualizarConfiguracoesOrganizacao({
        name: form.name.trim(),
        document_id: form.document_id.trim() || null,
      });
      toast.success("Dados da organização salvos.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar os dados da organização.");
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <LoadingState rows={3} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <Card className="rounded-[var(--radius-lg)]">
      <CardHeader>
        <CardTitle className="text-base">Dados da Organização</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome da Organização</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>CNPJ / Documento</Label>
          <Input
            value={form.document_id}
            onChange={(e) => setForm({ ...form, document_id: e.target.value })}
            placeholder="00.000.000/0000-00"
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MembrosPermissoes() {
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.listarMembrosOrganizacao(), []);
  const [dialogAberto, setDialogAberto] = useState(false);

  if (loading) return <LoadingState rows={4} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogAberto(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Convidar Membro
        </Button>
      </div>

      {data && data.items.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHeaderGold>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Desde</TableHead>
            </TableHeaderGold>
            <TableBody>
              {data.items.map((membro) => (
                <TableRow key={membro.id}>
                  <TableCell className="font-medium">{membro.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{membro.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={membro.role === "owner" ? "secondary" : "outline"}>
                      {ROLE_LABELS[membro.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(membro.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <EmptyState title="Nenhum membro encontrado" />
      )}

      <ConvidarMembroDialog open={dialogAberto} onOpenChange={setDialogAberto} onConvidado={refetch} />
    </div>
  );
}

function ConvidarMembroDialog({
  open,
  onOpenChange,
  onConvidado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConvidado: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<OrganizationRole, "owner">>("viewer");
  const [enviando, setEnviando] = useState(false);

  function fechar() {
    onOpenChange(false);
    setEmail("");
    setRole("viewer");
  }

  async function enviar() {
    if (!email.trim()) {
      toast.error("Informe o e-mail do convidado.");
      return;
    }
    setEnviando(true);
    try {
      await viabilidadeApi.convidarMembro({ email: email.trim(), role });
      toast.success("Convite enviado.");
      onConvidado();
      fechar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível enviar o convite.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar Membro</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              placeholder="nome@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v as Exclude<OrganizationRole, "owner">)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="executor">Executor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={enviando}>
            <Plus className="mr-1 h-4 w-4" />
            {enviando ? "Enviando..." : "Enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssinaturaPlano() {
  const { data, loading, error, refetch } = useApiResource(() => viabilidadeApi.obterAssinaturaOrganizacao(), []);

  if (loading) return <LoadingState rows={3} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Plano Atual"
        value={PLAN_TIER_LABELS[data.plan_tier]}
        status={{
          label: SUBSCRIPTION_STATUS_LABELS[data.subscription_status],
          variant: data.subscription_status === "active" ? "secondary" : "destructive",
        }}
      />
      <MetricCard
        label="Contratos Ativos"
        value={`${data.usage.active_contracts} de ${data.capacity.max_active_contracts}`}
        secondary="Limite do plano contratado"
      />
      <MetricCard
        label="Usuários Executor"
        value={`${data.usage.executors} de ${data.capacity.max_executors}`}
        secondary="Capacidade de escrita"
      />
      <MetricCard
        label="Usuários Viewer"
        value={`${data.usage.viewers} de ${data.capacity.max_viewers}`}
        secondary="Capacidade de leitura"
      />
    </div>
  );
}
