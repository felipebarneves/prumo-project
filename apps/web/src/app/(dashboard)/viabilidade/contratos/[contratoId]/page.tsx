"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { LoadingState } from "@/components/finance/states";
import { viabilidadeApi } from "@/lib/api/viabilidade";

/**
 * Rota de entrada de um projeto — sem tela própria (PRD Tela 7: "a versão mais
 * recente sempre abre por padrão"). Resolve as versões e redireciona para a
 * primeira tela do fluxo (Parâmetros de Input) na versão mais recente.
 */
export default function ContratoRedirectPage() {
  const { contratoId } = useParams<{ contratoId: string }>();
  const router = useRouter();

  useEffect(() => {
    viabilidadeApi.listarVersoes(contratoId).then((versoes) => {
      if (versoes.length === 0) return;
      router.replace(`/viabilidade/contratos/${contratoId}/versoes/${versoes[0].id}/parametros`);
    });
  }, [contratoId, router]);

  return <LoadingState rows={3} />;
}
