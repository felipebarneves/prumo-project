"use client";

import { useParams } from "next/navigation";

import { HistoricoVersoes } from "@/components/viabilidade/historico-versoes";

export default function HistoricoPage() {
  const { contratoId, versaoId } = useParams<{ contratoId: string; versaoId: string }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-sm text-muted-foreground">Histórico de versões do projeto.</p>
      </div>

      <HistoricoVersoes contratoId={contratoId} versaoAtualId={versaoId} />
    </div>
  );
}
