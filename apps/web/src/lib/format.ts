/**
 * Formatação padrão pt-BR — CLAUDE.md (nova-frontend): todo valor monetário exibido
 * na interface usa Intl.NumberFormat('pt-BR', ...). Convenção de KPI não calculável
 * (PRD): `null`/`undefined` sempre renderiza como "—", nunca como zero.
 */

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Tabelas de Cronograma/DRE/Fluxo de Caixa arredondam para inteiros (sem casas
// decimais) — reduz ruído visual em tabelas densas com muitas colunas de mês.
// Telas fora de tabela (KPI cards, formulários) continuam usando o formatter
// padrão de 2 casas via formatCurrency(valor) sem o segundo argumento.
const currencyFormatterSemDecimais = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

const MESES_ABREVIADOS_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

export function formatCurrency(
  valor: string | number | null | undefined,
  opcoes?: { casasDecimais?: 0 | 2 }
): string {
  if (valor === null || valor === undefined) return "—";
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (Number.isNaN(numero)) return "—";
  const formatter = opcoes?.casasDecimais === 0 ? currencyFormatterSemDecimais : currencyFormatter;
  return formatter.format(numero);
}

export function formatNumber(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (Number.isNaN(numero)) return "—";
  return numberFormatter.format(numero);
}

export function formatPercent(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (Number.isNaN(numero)) return "—";
  return percentFormatter.format(numero);
}

export function formatDate(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  const data = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(data.getTime())) return "—";
  return dateFormatter.format(data);
}

export function formatMonth(mes: number | null | undefined): string {
  if (mes === null || mes === undefined) return "—";
  return `Mês ${mes}`;
}

/**
 * Mês/ano abreviado (ex: "out/26") de uma coluna de mês relativo (1 = mês de
 * início do contrato), calculado a partir de `data_inicio` do contrato — usado
 * no cabeçalho duplo das tabelas de Cronograma/DRE/Fluxo de Caixa. Cálculo em
 * UTC porque `data_inicio` chega como string "YYYY-MM-DD" (date-only), que o
 * `Date` nativo interpreta como meia-noite UTC — usar getMonth/getFullYear
 * (hora local) deslocaria o mês em fusos horários negativos (ex: America/*).
 */
export function formatMesAno(dataInicio: string | null | undefined, indiceMes: number): string {
  if (!dataInicio) return "";
  const base = new Date(dataInicio);
  if (Number.isNaN(base.getTime())) return "";
  const data = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + (indiceMes - 1), 1));
  const mes = MESES_ABREVIADOS_PT[data.getUTCMonth()];
  const ano = String(data.getUTCFullYear()).slice(-2);
  return `${mes}/${ano}`;
}
