/**
 * Cliente de integração HTTP do módulo Viabilidade — um método por endpoint do
 * contrato do Atlas (docs/api-spec-viabilidade.md). Nenhuma regra de cálculo
 * financeiro é implementada aqui — apenas serialização/desserialização.
 */
import { apiRequest } from "./client";
import type {
  Contrato,
  ContratoCreatePayload,
  ContratoListResponse,
  CronogramaResponse,
  DashboardProjetoResponse,
  DespesaNaoOperacional,
  DREDetalhadoResponse,
  FluxoCaixaResponse,
  GranularidadeResumo,
  HomeOrganizacaoResponse,
  LinhaCusto,
  LinhaReceita,
  ModuloPrumo,
  ParametrosVersao,
  ResumoDREResponse,
  Snapshot,
  StatusCicloVida,
  Versao,
  ComparacaoResponse,
  WhatIfPayload,
  WhatIfResponse,
} from "@/lib/types/viabilidade";

// --------------------------------------------------------------------------- Contratos (Tela 1)

export type ListarContratosParams = {
  status_ciclo_vida?: StatusCicloVida;
  modulo_vinculado?: ModuloPrumo;
  mostrar_arquivados?: boolean;
  busca?: string;
  page?: number;
  page_size?: number;
};

export const viabilidadeApi = {
  listarContratos: (params: ListarContratosParams = {}) =>
    apiRequest<ContratoListResponse>("/api/v1/contratos", { searchParams: params }),

  obterContrato: (contratoId: string) => apiRequest<Contrato>(`/api/v1/contratos/${contratoId}`),

  criarContrato: (payload: ContratoCreatePayload) =>
    apiRequest<Contrato>("/api/v1/contratos", { method: "POST", body: payload }),

  arquivarContrato: (contratoId: string) =>
    apiRequest<{ contrato_id: string; modulos_afetados: ModuloPrumo[]; arquivado_em: string }>(
      `/api/v1/contratos/${contratoId}/arquivar`,
      { method: "POST" }
    ),

  desarquivarContrato: (contratoId: string) =>
    apiRequest<Contrato>(`/api/v1/contratos/${contratoId}/desarquivar`, { method: "POST" }),

  excluirContrato: (contratoId: string) =>
    apiRequest<void>(`/api/v1/contratos/${contratoId}`, { method: "DELETE" }),

  // --------------------------------------------------------------------------- Versões (Tela 7)

  listarVersoes: (contratoId: string) => apiRequest<Versao[]>(`/api/v1/contratos/${contratoId}/versoes`),

  criarVersao: (contratoId: string, nomeVersao: string, origemVersaoId?: string | null) =>
    apiRequest<Versao>(`/api/v1/contratos/${contratoId}/versoes`, {
      method: "POST",
      body: { nome_versao: nomeVersao, origem_versao_id: origemVersaoId ?? null },
    }),

  renomearVersao: (contratoId: string, versaoId: string, nomeVersao: string) =>
    apiRequest<Versao>(`/api/v1/contratos/${contratoId}/versoes/${versaoId}`, {
      method: "PATCH",
      body: { nome_versao: nomeVersao },
    }),

  excluirVersao: (contratoId: string, versaoId: string) =>
    apiRequest<{ versao_id_excluida: string; versao_substituta_id: string | null }>(
      `/api/v1/contratos/${contratoId}/versoes/${versaoId}`,
      { method: "DELETE" }
    ),

  compararVersoes: (contratoId: string, versaoAId: string, versaoBId: string) =>
    apiRequest<ComparacaoResponse>(`/api/v1/contratos/${contratoId}/comparacoes`, {
      method: "POST",
      body: { versao_a_id: versaoAId, versao_b_id: versaoBId },
    }),

  simularWhatIf: (contratoId: string, payload: WhatIfPayload) =>
    apiRequest<WhatIfResponse>(`/api/v1/contratos/${contratoId}/whatif`, { method: "POST", body: payload }),

  listarSnapshots: (contratoId: string) => apiRequest<Snapshot[]>(`/api/v1/contratos/${contratoId}/snapshots`),

  excluirSnapshot: (contratoId: string, snapshotId: string) =>
    apiRequest<void>(`/api/v1/contratos/${contratoId}/snapshots/${snapshotId}`, { method: "DELETE" }),

  // --------------------------------------------------------------------------- Parâmetros (Tela 2)

  obterParametros: (versaoId: string) => apiRequest<ParametrosVersao>(`/api/v1/versoes/${versaoId}/parametros`),

  gravarParametros: (
    versaoId: string,
    payload: {
      aliquota_tributaria_efetiva: string;
      tma: string | null;
      taxa_reinvestimento: string | null;
      taxa_custo_captacao: string | null;
    }
  ) => apiRequest<ParametrosVersao>(`/api/v1/versoes/${versaoId}/parametros`, { method: "PUT", body: payload }),

  // --------------------------------------------------------------------------- Linhas de Receita / Custo

  listarLinhasReceita: (versaoId: string) => apiRequest<LinhaReceita[]>(`/api/v1/versoes/${versaoId}/linhas-receita`),

  criarLinhaReceita: (
    versaoId: string,
    payload: Omit<LinhaReceita, "id" | "versao_id" | "valor_total_calculado" | "origem_line_id" | "bloqueado_por_origem" | "bloqueado_por_override" | "created_at" | "updated_at">
  ) => apiRequest<LinhaReceita>(`/api/v1/versoes/${versaoId}/linhas-receita`, { method: "POST", body: payload }),

  atualizarLinhaReceita: (versaoId: string, linhaId: string, payload: Partial<LinhaReceita>) =>
    apiRequest<LinhaReceita>(`/api/v1/versoes/${versaoId}/linhas-receita/${linhaId}`, {
      method: "PATCH",
      body: payload,
    }),

  excluirLinhaReceita: (versaoId: string, linhaId: string) =>
    apiRequest<void>(`/api/v1/versoes/${versaoId}/linhas-receita/${linhaId}`, { method: "DELETE" }),

  listarLinhasCusto: (versaoId: string) => apiRequest<LinhaCusto[]>(`/api/v1/versoes/${versaoId}/linhas-custo`),

  criarLinhaCusto: (
    versaoId: string,
    payload: Omit<LinhaCusto, "id" | "versao_id" | "custo_total_calculado" | "origem_line_id" | "bloqueado_por_origem" | "bloqueado_por_override" | "created_at" | "updated_at">
  ) => apiRequest<LinhaCusto>(`/api/v1/versoes/${versaoId}/linhas-custo`, { method: "POST", body: payload }),

  atualizarLinhaCusto: (versaoId: string, linhaId: string, payload: Partial<LinhaCusto>) =>
    apiRequest<LinhaCusto>(`/api/v1/versoes/${versaoId}/linhas-custo/${linhaId}`, {
      method: "PATCH",
      body: payload,
    }),

  excluirLinhaCusto: (versaoId: string, linhaId: string) =>
    apiRequest<void>(`/api/v1/versoes/${versaoId}/linhas-custo/${linhaId}`, { method: "DELETE" }),

  // --------------------------------------------------------------------------- Despesas Não Operacionais

  listarDespesas: (versaoId: string) =>
    apiRequest<DespesaNaoOperacional[]>(`/api/v1/versoes/${versaoId}/despesas-nao-operacionais`),

  criarDespesa: (
    versaoId: string,
    payload: Pick<DespesaNaoOperacional, "descricao" | "tipo" | "percentual" | "linha_receita_referencia_id">
  ) =>
    apiRequest<DespesaNaoOperacional>(`/api/v1/versoes/${versaoId}/despesas-nao-operacionais`, {
      method: "POST",
      body: payload,
    }),

  atualizarDespesa: (versaoId: string, despesaId: string, payload: Partial<DespesaNaoOperacional>) =>
    apiRequest<DespesaNaoOperacional>(`/api/v1/versoes/${versaoId}/despesas-nao-operacionais/${despesaId}`, {
      method: "PATCH",
      body: payload,
    }),

  excluirDespesa: (versaoId: string, despesaId: string) =>
    apiRequest<void>(`/api/v1/versoes/${versaoId}/despesas-nao-operacionais/${despesaId}`, { method: "DELETE" }),

  // --------------------------------------------------------------------------- Cronograma (Tela 3)

  obterCronogramaReceita: (versaoId: string) =>
    apiRequest<CronogramaResponse>(`/api/v1/versoes/${versaoId}/cronograma/receita`),

  obterCronogramaCusto: (versaoId: string) =>
    apiRequest<CronogramaResponse>(`/api/v1/versoes/${versaoId}/cronograma/custo`),

  atualizarCelulasReceita: (versaoId: string, linhaId: string, celulas: { mes: number; volumetria: string }[]) =>
    apiRequest(`/api/v1/versoes/${versaoId}/cronograma/receita/${linhaId}/celulas`, {
      method: "PUT",
      body: { celulas },
    }),

  atualizarCelulasCusto: (versaoId: string, linhaId: string, celulas: { mes: number; volumetria: string }[]) =>
    apiRequest(`/api/v1/versoes/${versaoId}/cronograma/custo/${linhaId}/celulas`, {
      method: "PUT",
      body: { celulas },
    }),

  resetarDistribuicaoReceita: (versaoId: string, linhaId: string) =>
    apiRequest(`/api/v1/versoes/${versaoId}/cronograma/receita/${linhaId}/reset`, { method: "POST" }),

  resetarDistribuicaoCusto: (versaoId: string, linhaId: string) =>
    apiRequest(`/api/v1/versoes/${versaoId}/cronograma/custo/${linhaId}/reset`, { method: "POST" }),

  // --------------------------------------------------------------------------- DRE (Tela 4)

  obterDREDetalhado: (versaoId: string) =>
    apiRequest<DREDetalhadoResponse>(`/api/v1/versoes/${versaoId}/dre/detalhado`),

  obterResumoDRE: (versaoId: string, granularidade: GranularidadeResumo) =>
    apiRequest<ResumoDREResponse>(`/api/v1/versoes/${versaoId}/dre/resumo`, { searchParams: { granularidade } }),

  // --------------------------------------------------------------------------- Fluxo de Caixa (Tela 5)

  obterFluxoCaixa: (versaoId: string) => apiRequest<FluxoCaixaResponse>(`/api/v1/versoes/${versaoId}/fluxo-caixa`),

  // --------------------------------------------------------------------------- Dashboard (Tela 6 / 8)

  obterDashboardProjeto: (versaoId: string) =>
    apiRequest<DashboardProjetoResponse>(`/api/v1/versoes/${versaoId}/dashboard`),

  obterHomeOrganizacao: () => apiRequest<HomeOrganizacaoResponse>("/api/v1/organizations/me/home"),
};
