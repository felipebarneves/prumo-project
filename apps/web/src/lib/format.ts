/**
 * Formatação padrão pt-BR — CLAUDE.md (nova-frontend): todo valor monetário exibido
 * na interface usa Intl.NumberFormat('pt-BR', ...). Convenção de KPI não calculável
 * (PRD): `null`/`undefined` sempre renderiza como "—", nunca como zero.
 */

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
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

export function formatCurrency(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (Number.isNaN(numero)) return "—";
  return currencyFormatter.format(numero);
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
