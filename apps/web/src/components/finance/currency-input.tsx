"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Mesma máscara "caixa eletrônico" do PercentInput (ver percent-input.tsx),
 * aplicada a valores monetários: os dígitos preenchem o buffer da direita
 * para a esquerda, com as 2 casas finais sempre sendo os centavos —
 * "1215" vira "R$ 12,15".
 */
function digitsParaExibicao(digits: string, negativo: boolean): string {
  const numero = (Number(digits || "0") / 100) * (negativo ? -1 : 1);
  return `R$ ${numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * O contrato da API para valores monetários é um número decimal simples em
 * string (ex: "12.15", não fração nem percentual) — ver LinhaReceita.valor_unitario
 * e LinhaCusto.custo_unitario.
 */
function digitsParaValor(digits: string, negativo: boolean): string {
  if (!digits) return "";
  const numero = (Number(digits) / 100) * (negativo ? -1 : 1);
  return numero.toFixed(2);
}

function valorParaDigitos(valor: string | null | undefined): { digits: string; negativo: boolean } {
  if (valor == null || valor === "") return { digits: "", negativo: false };
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return { digits: "", negativo: false };
  const negativo = numero < 0;
  const digits = String(Math.round(Math.abs(numero) * 100));
  return { digits: digits === "0" ? "" : digits, negativo };
}

interface CurrencyInputProps {
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Valor no formato do contrato da API — número decimal em string (ex: "12.15"). Vazio/null exibe o campo em branco. */
  value: string | null | undefined;
  /** Chamado com o valor decimal em string a cada edição — "" quando o campo fica vazio. */
  onChange: (valor: string) => void;
  allowNegative?: boolean;
}

export function CurrencyInput({
  id,
  className,
  placeholder,
  disabled,
  value,
  onChange,
  allowNegative = false,
}: CurrencyInputProps) {
  const [estado, setEstado] = useState(() => valorParaDigitos(value));
  // Mesmo padrão de "ajuste de estado durante a renderização" do PercentInput
  // (ver percent-input.tsx) — evita o efeito extra e o re-render em cascata
  // de um useEffect+setState para sincronizar com dados assíncronos.
  const [valorSincronizado, setValorSincronizado] = useState(value);

  if (value !== valorSincronizado && value !== digitsParaValor(estado.digits, estado.negativo)) {
    setValorSincronizado(value);
    setEstado(valorParaDigitos(value));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const bruto = e.target.value;
    const negativo = allowNegative ? bruto.trim().startsWith("-") : false;
    const digits = bruto.replace(/\D/g, "").slice(0, 12); // teto de segurança contra strings absurdamente longas
    setEstado({ digits, negativo });
    onChange(digitsParaValor(digits, negativo));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (allowNegative && e.key === "-") {
      e.preventDefault();
      const novoEstado = { ...estado, negativo: !estado.negativo };
      setEstado(novoEstado);
      onChange(digitsParaValor(novoEstado.digits, novoEstado.negativo));
    }
  }

  const exibicao = estado.digits
    ? digitsParaExibicao(estado.digits, estado.negativo)
    : estado.negativo
      ? "-"
      : "";

  return (
    <Input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder ?? "R$ 0,00"}
      disabled={disabled}
      className={cn("text-right tabular-nums", className)}
      value={exibicao}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}
