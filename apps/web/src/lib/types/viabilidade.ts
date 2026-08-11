/**
 * Tipos TypeScript espelhando os schemas Pydantic do Kaiser (apps/api/app/modules/viabilidade/schemas/)
 * e o contrato do Atlas (docs/api-spec-viabilidade.md). Nunca alterar nomes de campo aqui sem
 * alinhamento com o backend — CLAUDE.md (nova-frontend), "Fidelidade ao Contrato de API".
 *
 * Valores decimais chegam da API como string (serialização JSON de Decimal do Pydantic) —
 * os componentes de UI usam lib/format.ts para converter para exibição, nunca fazendo
 * aritmética financeira no cliente.
 */

export type OrganizationRole = "owner" | "executor" | "viewer";
export type RegimeTributario = "lucro_presumido" | "lucro_real";
export type StatusCicloVida =
  | "em_prospeccao"
  | "contrato_assinado"
  | "em_execucao"
  | "encerrado"
  | "cancelado";
export type PrazoPagamento = 30 | 60 | 90;
export type ModuloPrumo = "precificacao" | "gestao";
export type DespesaTipo = "despesa" | "recuperacao";
export type SnapshotTipo = "comparacao" | "whatif";
export type GranularidadeResumo = "trimestral" | "semestral" | "anual";
export type PlanTier = "starter" | "pro_planejamento" | "pro_execucao" | "master";
export type SubscriptionStatus = "active" | "past_due" | "inactive";

export interface ErrorResponseBody {
  error_code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

// --------------------------------------------------------------------------- Tela Configurações

export interface OrganizationSettings {
  id: string;
  name: string;
  document_id: string | null;
  plan_tier: PlanTier;
  subscription_status: SubscriptionStatus;
  created_at: string;
}

export interface OrganizationSettingsUpdatePayload {
  name: string;
  document_id: string | null;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  role: OrganizationRole;
  created_at: string;
}

export interface OrganizationMembersResponse {
  items: OrganizationMember[];
  total: number;
}

export interface PlanCapacity {
  max_executors: number;
  max_viewers: number;
  max_active_contracts: number;
}

export interface PlanUsage {
  executors: number;
  viewers: number;
  active_contracts: number;
}

export interface OrganizationSubscription {
  plan_tier: PlanTier;
  subscription_status: SubscriptionStatus;
  capacity: PlanCapacity;
  usage: PlanUsage;
}

export interface ConviteCreatePayload {
  email: string;
  role: Exclude<OrganizationRole, "owner">;
}

export interface ConviteCreateResponse {
  id: string;
  email: string;
  role: OrganizationRole;
  status: string;
  expires_at: string;
}

// --------------------------------------------------------------------------- Contratos (Tela 1)

export interface Contrato {
  id: string;
  organization_id: string;
  nome_projeto: string;
  cliente: string;
  data_inicio: string;
  duracao_meses: number;
  nome_contrato: string;
  prazo_pagamento_dias: PrazoPagamento;
  regime_tributario: RegimeTributario;
  status_ciclo_vida: StatusCicloVida;
  moeda: "BRL";
  codigo_interno: string | null;
  segmento_cliente_final: string | null;
  arquivado_em: string | null;
  modulos_vinculados: ModuloPrumo[];
  versao_inicial_id: string;
  created_at: string;
}

export interface ContratoListItem {
  id: string;
  nome_projeto: string;
  cliente: string;
  status_ciclo_vida: StatusCicloVida;
  modulos_vinculados: ModuloPrumo[];
  arquivado: boolean;
  created_at: string;
}

export interface ContratoListResponse {
  items: ContratoListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ContratoCreatePayload {
  nome_projeto: string;
  cliente: string;
  data_inicio: string;
  duracao_meses: number;
  nome_contrato: string;
  prazo_pagamento_dias: PrazoPagamento;
  nome_versao: string;
  regime_tributario: RegimeTributario;
  status_ciclo_vida?: StatusCicloVida;
  codigo_interno?: string | null;
  segmento_cliente_final?: string | null;
}

// --------------------------------------------------------------------------- Versões (Tela 7)

export interface Versao {
  id: string;
  contrato_id: string;
  nome_versao: string;
  origem_versao_id: string | null;
  criado_por: string;
  created_at: string;
  vinculo_precificacao_ativo: boolean;
}

export interface ComparacaoMetricas {
  receita_bruta: string;
  impostos: string;
  receita_liquida: string;
  custos_totais: string;
  ebitda: string;
  margem_ebitda: string;
  payback_mes: number | null;
}

export interface ComparacaoResponse {
  versao_a: ComparacaoMetricas;
  versao_b: ComparacaoMetricas;
}

export interface WhatIfPayload {
  versao_base_id: string;
  ajuste_receita_pct: string;
  ajuste_custo_pct: string;
  ajuste_volumetria_receita_pct: string;
}

export interface WhatIfResponse {
  versao_base: ComparacaoMetricas;
  resultado_simulado: ComparacaoMetricas;
  ajustes_aplicados: WhatIfPayload;
}

export interface Snapshot {
  id: string;
  contrato_id: string;
  tipo: SnapshotTipo;
  nome: string;
  versao_a_id: string;
  versao_b_id: string | null;
  resultado: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface SnapshotCreatePayload {
  tipo: SnapshotTipo;
  nome: string;
  versao_a_id: string;
  versao_b_id?: string | null;
  ajustes_whatif?: WhatIfPayload | null;
  resultado: ComparacaoResponse | WhatIfResponse;
}

// --------------------------------------------------------------------------- Parâmetros (Tela 2)

export interface ParametrosVersao {
  versao_id: string;
  aliquota_tributaria_efetiva: string;
  tma: string | null;
  taxa_reinvestimento: string | null;
  taxa_custo_captacao: string | null;
  updated_at: string | null;
}

// --------------------------------------------------------------------------- Linhas (Tela 2)

export interface LinhaReceita {
  id: string;
  versao_id: string;
  descricao: string;
  mes_inicio: number | null;
  prazo_meses: number | null;
  unidade_medida: string;
  volumetria: string;
  valor_unitario: string;
  valor_total_calculado: string;
  aliquota_especifica: string | null;
  origem_line_id: string | null;
  bloqueado_por_origem: boolean;
  bloqueado_por_override: boolean;
  created_at: string;
  updated_at: string;
}

export interface LinhaCusto {
  id: string;
  versao_id: string;
  descricao: string;
  mes_inicio: number | null;
  prazo_meses: number | null;
  unidade_medida: string;
  volumetria: string;
  custo_unitario: string;
  custo_total_calculado: string;
  origem_line_id: string | null;
  bloqueado_por_origem: boolean;
  bloqueado_por_override: boolean;
  created_at: string;
  updated_at: string;
}

export interface DespesaNaoOperacional {
  id: string;
  versao_id: string;
  descricao: string;
  tipo: DespesaTipo;
  percentual: string;
  linha_receita_referencia_id: string | null;
  created_at: string;
  updated_at: string;
}

// --------------------------------------------------------------------------- Cronograma (Tela 3)

export interface CelulaCronograma {
  mes: number;
  volumetria: string | null;
  valor_calculado: string | null;
  is_override: boolean;
  dentro_da_janela: boolean;
}

export interface LinhaCronograma {
  linha_id: string;
  descricao: string;
  total_linha: string;
  soma_distribuicao: string;
  divergente: boolean;
  celulas: CelulaCronograma[];
}

export interface CronogramaResponse {
  versao_id: string;
  meses: number[];
  linhas: LinhaCronograma[];
}

// --------------------------------------------------------------------------- DRE (Tela 4)

export interface DREItemMensal {
  mes: number;
  valor: string;
}

export interface DRELinha {
  item: string;
  total_projeto: string;
  valores_mensais: DREItemMensal[];
}

export interface DREDetalhadoResponse {
  versao_id: string;
  meses: number[];
  linhas: DRELinha[];
  nota_irpj: string;
}

export interface DREPeriodoConsolidado {
  periodo_label: string;
  valor: string;
}

export interface DRELinhaResumo {
  item: string;
  total_projeto: string;
  periodos: DREPeriodoConsolidado[];
}

export interface ResumoDREResponse {
  versao_id: string;
  granularidade: GranularidadeResumo;
  inicio_projeto: string;
  fim_contrato: string;
  prazo_meses: number;
  linhas: DRELinhaResumo[];
  nota_irpj: string;
}

// --------------------------------------------------------------------------- Fluxo de Caixa (Tela 5)

export interface FluxoCaixaLinha {
  item: string;
  valores_mensais: string[];
  total_projeto: string;
}

export interface FluxoCaixaResponse {
  versao_id: string;
  meses: number[];
  linhas: FluxoCaixaLinha[];
  capital_de_giro: string;
}

// --------------------------------------------------------------------------- Dashboard (Tela 6 / 8)

export interface DashboardKPIs {
  receita_bruta_total: string;
  ebitda_total: string;
  margem_ebitda: string;
  fluxo_liquido_total: string;
  vpl: string | null;
  tir: string | null;
  tirm: string | null;
  payback_mes: number | null;
  breakeven_mes: number | null;
  capital_de_giro: string;
  custo_financeiro_total: string;
}

export interface GraficoAnualSerie {
  ano: number;
  receita_liquida: string;
  custos: string;
  ebitda: string;
}

export interface GraficoFluxoCaixaAnualSerie {
  ano: number;
  fluxo_anual: string;
  caixa_acumulado: string;
}

export interface DashboardProjetoResponse {
  versao_id: string;
  kpis: DashboardKPIs;
  grafico_dre_por_ano: GraficoAnualSerie[];
  grafico_fluxo_caixa_por_ano: GraficoFluxoCaixaAnualSerie[];
}

export interface HomeOrganizacaoKPIs {
  receita_bruta_total: string;
  ebitda_total: string;
  margem_ebitda: string;
  contratos_ativos_atual: number;
  contratos_ativos_limite: number;
}

export interface HomeOrganizacaoResponse {
  kpis: HomeOrganizacaoKPIs;
}
