"use client";

import { useState } from "react";

import { formatCurrency } from "@/lib/format";

interface Serie {
  label: string;
  color: string;
  /** Além de renderizar como barra, sobrepõe uma curva de tendência (SVG) conectando o topo das barras desta série — para acumulados. */
  destacarComLinha?: boolean;
}

interface AnnualBarChartProps {
  categorias: string[];
  series: Serie[];
  /** valores[serieIndex][categoriaIndex] */
  valores: number[][];
}

/**
 * Gráfico de barras agrupadas, com curva de tendência opcional sobreposta,
 * sem dependência de biblioteca de charting (PRD 3.7 aceita visão estática
 * sem drill-down como suficiente para o MVP).
 *
 * Layout vertical de cada coluna, de cima para baixo: zona positiva (altura
 * `alturaPositiva`) → rodapé fixo (`ALTURA_RODAPE`, contém o rótulo do ano) →
 * zona negativa (altura `alturaNegativa`). As três alturas são globais
 * (mesmas para todas as colunas), calculadas uma vez a partir do maior valor
 * positivo e do maior |valor negativo| de toda a série. A linha de zero é um
 * único elemento absoluto cobrindo a largura inteira do gráfico — desenhá-la
 * por coluna (uma borda por div) produzia traços pretos fragmentados nas
 * bordas de cada categoria.
 *
 * Cada categoria é subdividida em `series.length` fatias iguais (via CSS
 * Grid, sem gap) e cada barra fica centralizada na sua fatia. O overlay SVG
 * de curva de tendência usa um viewBox com `categorias.length * series.length`
 * unidades, então o centro de cada fatia (`indiceGlobal + 0.5`) corresponde
 * exatamente ao centro da barra correspondente — sem depender de medir
 * pixels em runtime.
 */
const ALTURA_CONTAINER = 380;
const ALTURA_RODAPE = 24;
const ALTURA_UTIL = ALTURA_CONTAINER - ALTURA_RODAPE;

function corParaVariavelCss(colorClass: string): string {
  return `var(--${colorClass.replace(/^bg-/, "color-")})`;
}

export function AnnualBarChart({ categorias, series, valores }: AnnualBarChartProps) {
  const [indiceHover, setIndiceHover] = useState<number | null>(null);

  const numSeries = Math.max(series.length, 1);
  const numCategorias = Math.max(categorias.length, 1);

  const todosValores = valores.flat();
  const maximoPositivo = Math.max(0, ...todosValores);
  const maximoNegativo = Math.max(0, ...todosValores.map((v) => -v));
  const amplitude = Math.max(1, maximoPositivo + maximoNegativo);

  const alturaPositiva = (maximoPositivo / amplitude) * ALTURA_UTIL;
  const alturaNegativa = ALTURA_UTIL - alturaPositiva;

  /** Posição Y (em px, a partir do topo da coluna) de um valor no eixo do gráfico — também o topo da barra. */
  const calcularY = (valor: number) =>
    valor >= 0
      ? alturaPositiva - (valor / amplitude) * ALTURA_UTIL
      : alturaPositiva + ALTURA_RODAPE + (-valor / amplitude) * ALTURA_UTIL;

  const seriesComLinha = series.filter((s) => s.destacarComLinha);

  return (
    <div className="space-y-3 overflow-visible">
      <div className="relative min-h-[380px] overflow-visible" style={{ height: ALTURA_CONTAINER }}>
        {/* Linha de zero — um único traço contínuo cobrindo todo o gráfico */}
        <div className="absolute inset-x-0 border-t border-border" style={{ top: alturaPositiva }} />

        <div
          className="grid h-full overflow-visible"
          style={{ gridTemplateColumns: `repeat(${numCategorias}, minmax(0, 1fr))` }}
        >
          {categorias.map((categoria, categoriaIndex) => (
            <div
              key={categoria}
              className="relative overflow-visible"
              onMouseEnter={() => setIndiceHover(categoriaIndex)}
              onMouseLeave={() => setIndiceHover((atual) => (atual === categoriaIndex ? null : atual))}
            >
              {/* Zona positiva */}
              <div
                className="absolute inset-x-0 grid items-end"
                style={{ top: 0, height: alturaPositiva, gridTemplateColumns: `repeat(${numSeries}, 1fr)` }}
              >
                {series.map((serie, serieIndex) => {
                  const valor = valores[serieIndex]?.[categoriaIndex] ?? 0;
                  const altura = valor > 0 ? alturaPositiva - calcularY(valor) : 0;
                  return (
                    <div key={serie.label} className="flex justify-center">
                      <div className={`w-4 rounded-t-sm ${serie.color}`} style={{ height: altura }} />
                    </div>
                  );
                })}
              </div>

              {/* Rodapé: rótulo do ano (linha de zero é desenhada uma única vez fora do loop) */}
              <div
                className="absolute inset-x-0 flex items-center justify-center"
                style={{ top: alturaPositiva, height: ALTURA_RODAPE }}
              >
                <span className="font-mono text-[0.65rem] text-muted-foreground">{categoria}</span>
              </div>

              {/* Zona negativa */}
              <div
                className="absolute inset-x-0 grid items-start"
                style={{
                  top: alturaPositiva + ALTURA_RODAPE,
                  height: alturaNegativa,
                  gridTemplateColumns: `repeat(${numSeries}, 1fr)`,
                }}
              >
                {series.map((serie, serieIndex) => {
                  const valor = valores[serieIndex]?.[categoriaIndex] ?? 0;
                  const altura = valor < 0 ? calcularY(valor) - (alturaPositiva + ALTURA_RODAPE) : 0;
                  return (
                    <div key={serie.label} className="flex justify-center">
                      <div className={`w-4 rounded-b-sm opacity-60 ${serie.color}`} style={{ height: altura }} />
                    </div>
                  );
                })}
              </div>

              {/* Tooltip do ano */}
              {indiceHover === categoriaIndex ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-center overflow-visible">
                  <div className="-translate-y-full rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    <p className="mb-1 font-semibold">{categoria}</p>
                    <div className="space-y-0.5">
                      {series.map((serie, serieIndex) => {
                        const valor = valores[serieIndex]?.[categoriaIndex] ?? 0;
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

        {/* Overlay SVG: um único path contínuo por série marcada com destacarComLinha, conectando o topo de suas barras */}
        {seriesComLinha.length > 0 ? (
          <svg
            className="pointer-events-none absolute inset-0 z-10"
            width="100%"
            height={ALTURA_CONTAINER}
            viewBox={`0 0 ${numCategorias * numSeries} ${ALTURA_CONTAINER}`}
            preserveAspectRatio="none"
          >
            {seriesComLinha.map((serie) => {
              const serieIndex = series.indexOf(serie);
              const cor = corParaVariavelCss(serie.color);
              const pontos = categorias.map((_, categoriaIndex) => {
                const valor = valores[serieIndex]?.[categoriaIndex] ?? 0;
                return { x: categoriaIndex * numSeries + serieIndex + 0.5, y: calcularY(valor) };
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
            <span className={`h-2 w-2 rounded-full ${serie.color}`} />
            {serie.label}
            {serie.destacarComLinha ? <span className="ml-0.5 text-[0.65rem] text-muted-foreground/70">(tendência)</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
