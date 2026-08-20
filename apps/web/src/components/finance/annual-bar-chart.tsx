"use client";

import { useState } from "react";

import { formatCurrency } from "@/lib/format";

interface Serie {
  label: string;
  color: string;
  /** "linha" renderiza a série como curva de tendência (SVG overlay) em vez de barra — para acumulados. */
  tipo?: "barra" | "linha";
}

interface AnnualBarChartProps {
  categorias: string[];
  series: Serie[];
  /** valores[serieIndex][categoriaIndex] */
  valores: number[][];
}

/**
 * Gráfico de barras agrupadas + linha de tendência opcional, sem dependência
 * de biblioteca de charting (PRD 3.7 aceita visão estática sem drill-down
 * como suficiente para o MVP).
 *
 * Layout vertical de cada coluna, de cima para baixo: zona positiva (altura
 * `alturaPositiva`) → rodapé fixo (`ALTURA_RODAPE`, contém a linha de zero e
 * o rótulo do ano) → zona negativa (altura `alturaNegativa`). As três alturas
 * são globais (mesmas para todas as colunas), calculadas uma vez a partir do
 * maior valor positivo e do maior |valor negativo| de toda a série — é o que
 * garante uma única linha de zero alinhada no gráfico inteiro. O rótulo do
 * ano fica sempre no rodapé, nunca atrás das barras.
 *
 * As colunas usam CSS Grid com colunas de largura igual e `gap-0` (o
 * espaçamento visual vem de padding interno, não de gap) para que o overlay
 * SVG da linha de tendência — cujo viewBox usa 1 unidade por coluna — alinhe
 * seus pontos exatamente ao centro de cada coluna sem medir pixels via JS.
 */
const ALTURA_CONTAINER = 180;
const ALTURA_RODAPE = 22;
const ALTURA_UTIL = ALTURA_CONTAINER - ALTURA_RODAPE;

function corParaVariavelCss(colorClass: string): string {
  return `var(--${colorClass.replace(/^bg-/, "color-")})`;
}

export function AnnualBarChart({ categorias, series, valores }: AnnualBarChartProps) {
  const [indiceHover, setIndiceHover] = useState<number | null>(null);

  const seriesBarra = series.filter((s) => s.tipo !== "linha");
  const seriesLinha = series.filter((s) => s.tipo === "linha");

  const todosValores = valores.flat();
  const maximoPositivo = Math.max(0, ...todosValores);
  const maximoNegativo = Math.max(0, ...todosValores.map((v) => -v));
  const amplitude = Math.max(1, maximoPositivo + maximoNegativo);

  const alturaPositiva = (maximoPositivo / amplitude) * ALTURA_UTIL;
  const alturaNegativa = ALTURA_UTIL - alturaPositiva;

  /** Posição Y (em px, a partir do topo da coluna) de um valor no eixo do gráfico. */
  const calcularY = (valor: number) =>
    valor >= 0
      ? alturaPositiva - (valor / amplitude) * ALTURA_UTIL
      : alturaPositiva + ALTURA_RODAPE + (-valor / amplitude) * ALTURA_UTIL;

  return (
    <div className="space-y-3">
      <div className="relative" style={{ height: ALTURA_CONTAINER }}>
        <div
          className="grid h-full"
          style={{ gridTemplateColumns: `repeat(${Math.max(categorias.length, 1)}, minmax(0, 1fr))` }}
        >
          {categorias.map((categoria, categoriaIndex) => (
            <div
              key={categoria}
              className="relative"
              onMouseEnter={() => setIndiceHover(categoriaIndex)}
              onMouseLeave={() => setIndiceHover((atual) => (atual === categoriaIndex ? null : atual))}
            >
              {/* Zona positiva */}
              <div
                className="absolute inset-x-0 flex items-end justify-center gap-1 px-1"
                style={{ top: 0, height: alturaPositiva }}
              >
                {seriesBarra.map((serie) => {
                  const valor = valores[series.indexOf(serie)]?.[categoriaIndex] ?? 0;
                  const altura = valor > 0 ? alturaPositiva - calcularY(valor) : 0;
                  return (
                    <div
                      key={serie.label}
                      className={`w-4 rounded-t-sm ${serie.color}`}
                      style={{ height: altura }}
                    />
                  );
                })}
              </div>

              {/* Rodapé: linha de zero + rótulo do ano */}
              <div
                className="absolute inset-x-0 flex items-center justify-center border-t border-border"
                style={{ top: alturaPositiva, height: ALTURA_RODAPE }}
              >
                <span className="font-mono text-[0.65rem] text-muted-foreground">{categoria}</span>
              </div>

              {/* Zona negativa */}
              <div
                className="absolute inset-x-0 flex items-start justify-center gap-1 px-1"
                style={{ top: alturaPositiva + ALTURA_RODAPE, height: alturaNegativa }}
              >
                {seriesBarra.map((serie) => {
                  const valor = valores[series.indexOf(serie)]?.[categoriaIndex] ?? 0;
                  const altura = valor < 0 ? calcularY(valor) - (alturaPositiva + ALTURA_RODAPE) : 0;
                  return (
                    <div
                      key={serie.label}
                      className={`w-4 rounded-b-sm opacity-60 ${serie.color}`}
                      style={{ height: altura }}
                    />
                  );
                })}
              </div>

              {/* Tooltip do ano */}
              {indiceHover === categoriaIndex ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center">
                  <div className="-translate-y-full rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    <p className="mb-1 font-semibold">{categoria}</p>
                    <div className="space-y-0.5">
                      {series.map((serie) => {
                        const valor = valores[series.indexOf(serie)]?.[categoriaIndex] ?? 0;
                        return (
                          <div key={serie.label} className="flex items-center gap-2 whitespace-nowrap">
                            <span className={`h-2 w-2 rounded-full ${serie.color}`} />
                            <span className="text-muted-foreground">{serie.label}:</span>
                            <span className="font-mono">{formatCurrency(valor)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Overlay SVG: curva(s) de tendência para séries do tipo "linha" */}
        {seriesLinha.length > 0 ? (
          <svg
            className="pointer-events-none absolute inset-0"
            width="100%"
            height={ALTURA_CONTAINER}
            viewBox={`0 0 ${Math.max(categorias.length, 1)} ${ALTURA_CONTAINER}`}
            preserveAspectRatio="none"
          >
            {seriesLinha.map((serie) => {
              const cor = corParaVariavelCss(serie.color);
              const pontos = categorias.map((_, categoriaIndex) => {
                const valor = valores[series.indexOf(serie)]?.[categoriaIndex] ?? 0;
                return { x: categoriaIndex + 0.5, y: calcularY(valor) };
              });
              const pathD = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
              return (
                <g key={serie.label}>
                  <path d={pathD} fill="none" stroke={cor} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  {pontos.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={3} fill={cor} vectorEffect="non-scaling-stroke" />
                  ))}
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-4">
        {series.map((serie) => (
          <div key={serie.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {serie.tipo === "linha" ? (
              <span className={`h-0.5 w-3 rounded-full ${serie.color}`} />
            ) : (
              <span className={`h-2 w-2 rounded-full ${serie.color}`} />
            )}
            {serie.label}
          </div>
        ))}
      </div>
    </div>
  );
}
