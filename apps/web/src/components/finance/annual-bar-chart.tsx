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
 * Gráfico de barras agrupadas, com grade horizontal e curva de tendência
 * opcional sobrepostas, sem dependência de biblioteca de charting (PRD 3.7
 * aceita visão estática sem drill-down como suficiente para o MVP).
 *
 * `ALTURA_CONTAINER` é o ÚNICO número usado tanto no cálculo em JS (posições
 * de barra/grade/linha) quanto na altura real do container (`style.height`).
 * Não usar `min-h`/`max-h` do Tailwind aqui: se a altura CSS renderizada
 * divergir da altura usada nos cálculos, os elementos posicionados por
 * `top` em px (grade, linha de zero, overlay SVG com `height` fixo) saem do
 * lugar e vazam para fora da área visível — foi exatamente isso que causou
 * os "riscos horizontais/diagonais" relatados quando o container tinha
 * `min-h-[380px]` mas podia ser clampado por um `max-h` menor em algum
 * breakpoint.
 *
 * Layout vertical de cada coluna, de cima para baixo: zona positiva (altura
 * `alturaPositiva`) → rodapé fixo (`ALTURA_RODAPE`, contém o rótulo do ano) →
 * zona negativa (altura `alturaNegativa`). Essas alturas são globais (mesmas
 * para todas as colunas), calculadas uma vez a partir do maior valor positivo
 * e do maior |valor negativo| de toda a série — garante uma única linha de
 * zero alinhada no gráfico inteiro.
 *
 * A grade horizontal usa `calcularStepAmigavel` para escolher um passo
 * "redondo" (1/2/5 × potência de 10) a partir da amplitude dos dados, e
 * reaproveita a mesma `calcularY` das barras — cada linha tracejada e cada
 * rótulo do eixo Y ficam exatamente na altura do valor que anunciam.
 *
 * A curva de tendência (série com `destacarComLinha`) mapeia X no centro
 * exato da coluna do ano (viewBox com `categorias.length` unidades de
 * largura) e Y por `calcularY` — um único `<path>` contínuo em dourado, com
 * nós circulares destacados.
 */
const ALTURA_CONTAINER = 300;
const ALTURA_RODAPE = 22;
const ALTURA_UTIL = ALTURA_CONTAINER - ALTURA_RODAPE;
const LARGURA_EIXO_Y = 52;
const COR_LINHA_TENDENCIA = "var(--gold-1)";

function calcularStepAmigavel(bruto: number): number {
  if (bruto <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(bruto));
  const residual = bruto / magnitude;
  const niceResidual = residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10;
  return niceResidual * magnitude;
}

function formatarEixoY(valor: number): string {
  const abs = Math.abs(valor);
  const sinal = valor < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sinal}R$${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sinal}R$${Math.round(abs / 1_000)}k`;
  return `${sinal}R$${Math.round(abs)}`;
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

  const stepGrade = calcularStepAmigavel(amplitude / 4);
  const linhasGrade: number[] = [0];
  for (let v = stepGrade; v <= maximoPositivo + stepGrade * 0.01; v += stepGrade) linhasGrade.push(v);
  for (let v = stepGrade; v <= maximoNegativo + stepGrade * 0.01; v += stepGrade) linhasGrade.push(-v);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {/* Eixo Y: rótulos alinhados à mesma altura das linhas de grade */}
        <div className="relative shrink-0" style={{ width: LARGURA_EIXO_Y, height: ALTURA_CONTAINER }}>
          {linhasGrade.map((valor) => (
            <span
              key={valor}
              className="absolute right-1 -translate-y-1/2 whitespace-nowrap text-[10px] text-muted-foreground"
              style={{ top: calcularY(valor) }}
            >
              {formatarEixoY(valor)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1 overflow-visible" style={{ height: ALTURA_CONTAINER }}>
          {/* Grade horizontal tracejada e sutil */}
          {linhasGrade
            .filter((v) => v !== 0)
            .map((valor) => (
              <div
                key={valor}
                className="absolute inset-x-0 border-t border-dashed border-border opacity-15"
                style={{ top: calcularY(valor) }}
              />
            ))}

          {/* Linha de zero — único traço contínuo cobrindo todo o gráfico */}
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

                {/* Tooltip do ano — ancorado ao grupo desta coluna, nunca ao gráfico inteiro */}
                {indiceHover === categoriaIndex ? (
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-center">
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

          {/* Overlay SVG: um único path contínuo por série marcada com destacarComLinha, no centro da coluna do ano.
              Nenhum outro <line>/<path> é desenhado aqui — grade e eixo de zero são divs, não SVG. */}
          {seriesComLinha.length > 0 ? (
            <svg
              className="pointer-events-none absolute inset-0 z-10"
              width="100%"
              height={ALTURA_CONTAINER}
              viewBox={`0 0 ${numCategorias} ${ALTURA_CONTAINER}`}
              preserveAspectRatio="none"
            >
              {seriesComLinha.map((serie) => {
                const serieIndex = series.indexOf(serie);
                const pontos = categorias.map((_, categoriaIndex) => {
                  const valor = valores[serieIndex]?.[categoriaIndex] ?? 0;
                  return { x: categoriaIndex + 0.5, y: calcularY(valor) };
                });
                const pathD = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
                return (
                  <g key={serie.label}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke={COR_LINHA_TENDENCIA}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    {pontos.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        fill={COR_LINHA_TENDENCIA}
                        stroke="var(--color-background)"
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 pl-[52px]">
        {series.map((serie) =>
          serie.destacarComLinha ? (
            <div key={serie.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <svg width="20" height="8" className="shrink-0">
                <line x1={0} y1={4} x2={20} y2={4} stroke={COR_LINHA_TENDENCIA} strokeWidth={2} />
                <circle cx={10} cy={4} r={3} fill={COR_LINHA_TENDENCIA} />
              </svg>
              {serie.label}
            </div>
          ) : (
            <div key={serie.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${serie.color}`} />
              {serie.label}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
