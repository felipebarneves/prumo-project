"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";

interface ApiResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook mínimo de carregamento — evita repetir loading/error/refetch em cada tela.
 * Não faz cache nem invalidação cross-tela (fora do escopo desta entrega); cada
 * página busca seus próprios dados ao montar e permite recarregar sob demanda.
 *
 * `fetcher` é chamado sempre que algum item de `deps` muda (mesma semântica de
 * um array de dependências de useEffect) — passe uma função estável e a lista
 * de valores primitivos dos quais ela depende (ex: [versaoId]).
 */
export function useApiResource<T>(fetcher: () => Promise<T>, deps: unknown[]): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Busca de dados assíncrona clássica: setState dentro do efeito é o próprio
  // propósito deste hook (não há API externa para "assinar" aqui, apenas uma
  // Promise HTTP) — desabilitando as regras experimentais do react-hooks que
  // pressupõem padrões baseados em `use()`/Suspense, fora do escopo desta entrega.
  useEffect(() => {
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    fetcher()
      .then((resultado) => {
        if (!cancelado) setData(resultado);
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        const mensagem = err instanceof ApiError ? err.message : "Erro inesperado ao carregar os dados.";
        setError(mensagem);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  return { data, loading, error, refetch: () => setReloadKey((k) => k + 1) };
}
