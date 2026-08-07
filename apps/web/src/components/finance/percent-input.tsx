"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Máscara "caixa eletrônico": os dígitos digitados preenchem o buffer da
 * direita para a esquerda, com as 2 casas finais sempre sendo os decimais —
 * "1215" vira "12,15", "5" vira "0,05". Backspace no fim do campo remove o
 * último dígito do buffer naturalmente (o valor exibido só tem dígitos +
 * vírgula, então qualquer edição do usuário sempre resulta em outra string
 * de dígitos ao remover os caracteres não numéricos).
 */
function digitsParaExibicao(digits: string, negativo: boolean): string {
  const padded = digits.padStart(3, "0");
  const parteInteira = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const parteDecimal = padded.slice(-2);
  return `${negativo ? "-" : ""}${parteInteira},${parteDecimal}`;
}

/**
 * O contrato da API para campos de taxa é a FRAÇÃO em string (ex: "0.1215"
 * para 12,15% — ver ParametrosVersao, WhatIfPayload, DespesaNaoOperacional
 * etc.). Este componente exibe o percentual mas emite/recebe sempre a
 * fração, para não quebrar esse contrato em nenhum consumidor existente.
 */
function digitsParaFracao(digits: string, negativo: boolean): string {
  if (!digits) return "";
  const percentual = Number(digits) / 100; // últimos 2 dígitos do buffer são as casas decimais do percentual
  const fracao = (percentual / 100) * (negativo ? -1 : 1);
  // Number(...).toString() elimina ruído de ponto flutuante (ex: 0.12150000000000001)
  return Number(fracao.toFixed(6)).toString();
}

function fracaoParaDigitos(fracao: string | null | undefined): { digits: string; negativo: boolean } {
  if (fracao == null || fracao === "") return { digits: "", negativo: false };
  const numero = Number(fracao);
  if (!Number.isFinite(numero)) return { digits: "", negativo: false };
  const percentual = numero * 100;
  const negativo = percentual < 0;
  const digits = String(Math.round(Math.abs(percentual) * 100));
  return { digits: digits === "0" ? "" : digits, negativo };
}

interface PercentInputProps {
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Valor no formato do contrato da API — fração em string (ex: "0.1215" para 12,15%). Vazio/null exibe o campo em branco. */
  value: string | null | undefined;
  /** Chamado com a fração em string a cada edição — "" quando o campo fica vazio (o chamador decide o fallback: "0" ou null, como já fazia antes). */
  onChange: (fracao: string) => void;
  /** Permite alternar o sinal com a tecla "-" (ex: ajustes de What-If, que podem ser negativos). */
  allowNegative?: boolean;
}

export function PercentInput({
  id,
  className,
  placeholder,
  disabled,
  value,
  onChange,
  allowNegative = false,
}: PercentInputProps) {
  const [estado, setEstado] = useState(() => fracaoParaDigitos(value));
  // Rastreia o último `value` externo já refletido no buffer — mesmo padrão de
  // "ajuste de estado durante a renderização" usado no restante do app (ver
  // ParametrosGeraisForm) para sincronizar com dados assíncronos/trocas de
  // versão sem o efeito extra e o re-render em cascata de um useEffect+setState.
  const [valorSincronizado, setValorSincronizado] = useState(value);

  if (value !== valorSincronizado && value !== digitsParaFracao(estado.digits, estado.negativo)) {
    setValorSincronizado(value);
    setEstado(fracaoParaDigitos(value));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const bruto = e.target.value;
    const negativo = allowNegative ? bruto.trim().startsWith("-") : false;
    const digits = bruto.replace(/\D/g, "").slice(0, 9); // teto de segurança contra strings absurdamente longas
    setEstado({ digits, negativo });
    onChange(digitsParaFracao(digits, negativo));
  }

  function alternarSinal() {
    if (!allowNegative) return;
    const novoEstado = { ...estado, negativo: !estado.negativo };
    setEstado(novoEstado);
    onChange(digitsParaFracao(novoEstado.digits, novoEstado.negativo));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (allowNegative && e.key === "-") {
      e.preventDefault();
      alternarSinal();
    }
  }

  const exibicao = estado.digits ? digitsParaExibicao(estado.digits, estado.negativo) : estado.negativo ? "-" : "";

  return (
    <Input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder ?? "0,00"}
      disabled={disabled}
      className={cn("text-right tabular-nums", className)}
      value={exibicao}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}
