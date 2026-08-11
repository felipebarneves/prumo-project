"use client";

import { useParams, useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VersionSelect } from "@/components/finance/version-select";
import { NovoProjetoDialog } from "@/components/viabilidade/novo-projeto-dialog";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { viabilidadeApi } from "@/lib/api/viabilidade";

/**
 * Cabeçalho global das páginas de Viabilidade — seletor de projeto/versão
 * ativos (quando há um projeto no contexto da rota) + atalho para criar um
 * novo projeto, disponível em qualquer tela do módulo.
 */
export function Header() {
  const router = useRouter();
  const params = useParams<{ contratoId?: string; versaoId?: string }>();
  const contratoId = Array.isArray(params?.contratoId) ? params.contratoId[0] : params?.contratoId;
  const versaoId = Array.isArray(params?.versaoId) ? params.versaoId[0] : params?.versaoId;
  const temProjetoAtivo = Boolean(contratoId && versaoId);

  const { data: contratos } = useApiResource(
    () => (temProjetoAtivo ? viabilidadeApi.listarContratos({ page_size: 100 }) : Promise.resolve(null)),
    [temProjetoAtivo]
  );
  const { data: versoes } = useApiResource(
    () => (contratoId ? viabilidadeApi.listarVersoes(contratoId) : Promise.resolve(null)),
    [contratoId]
  );

  const contratoAtivo = contratos?.items.find((c) => c.id === contratoId);

  function trocarProjeto(novoContratoId: string) {
    const alvo = contratos?.items.find((c) => c.id === novoContratoId);
    if (!alvo) return;
    router.push(`/viabilidade/contratos/${novoContratoId}/versoes/${alvo.id}/parametros`);
  }

  function trocarVersao(novaVersaoId: string) {
    router.push(`/viabilidade/contratos/${contratoId}/versoes/${novaVersaoId}/parametros`);
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {temProjetoAtivo ? (
          <>
            <Select value={contratoId} onValueChange={(v) => v && trocarProjeto(v)}>
              <SelectTrigger className="w-56">
                <SelectValue>{contratoAtivo?.nome_projeto ?? "Selecione o projeto"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {contratos?.items.map((contrato) => (
                  <SelectItem key={contrato.id} value={contrato.id}>
                    {contrato.nome_projeto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
              Versão
            </span>
            <VersionSelect
              versoes={versoes}
              versaoAtualId={versaoId ?? ""}
              value={versaoId ?? null}
              onChange={trocarVersao}
              placeholder="Selecione a versão"
              className="w-48"
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum projeto selecionado</p>
        )}
      </div>

      <NovoProjetoDialog />
    </header>
  );
}
