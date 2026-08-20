import { formatCurrency } from "@/lib/format";

interface Serie {
  label: string;
  color: string;
}

interface AnnualBarChartProps {
  categorias: string[];
  series: Serie[];
  /** valores[serieIndex][categoriaIndex] */
  valores: number[][];
}

/**
 * Gráfico de barras agrupadas minimalista (sem dependência de biblioteca de
 * charting — PRD 3.7 aceita visão estática sem drill-down como suficiente para
 * o MVP). Barras dimensionadas via CSS Grid/Tailwind, não SVG, para manter a
 * regra de "sem estilos inline" (apenas a altura/posição da barra é uma
 * variável calculada em runtime, atribuída via `style` por ser um dado, não
 * uma escolha de estilo).
 *
 * A área do gráfico tem altura fixa em px (`ALTURA_CONTAINER`) e cada coluna
 * é dividida em duas metades relativas por uma linha de zero posicionada
 * proporcionalmente entre o maior valor positivo e o maior |valor negativo|
 * da série inteira — necessário porque KPIs anuais como EBITDA podem ser
 * negativos (ex.: ano de ramp-up sem receita). Barras negativas crescem para
 * baixo a partir da linha de zero e usam opacidade reduzida para se
 * distinguirem das positivas sem precisar de uma paleta extra.
 *
 * Nota: o pai do container de barras precisa esticar cada coluna até a altura
 * cheia (`items-stretch`) — usar `items-end` aqui faz o filho `h-full`/`flex-1`
 * colapsar para altura 0 (o cross-size do item de flex não tem base definida
 * quando o align do pai não é `stretch`), e as barras somem mesmo com dados
 * válidos.
 */
const ALTURA_CONTAINER = 180;

export function AnnualBarChart({ categorias, series, valores }: AnnualBarChartProps) {
  const todosValores = valores.flat();
  const maximoPositivo = Math.max(0, ...todosValores);
  const maximoNegativo = Math.max(0, ...todosValores.map((v) => -v));
  const amplitude = Math.max(1, maximoPositivo + maximoNegativo);
  const offsetZero = (maximoPositivo / amplitude) * ALTURA_CONTAINER;

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-4 overflow-x-auto pb-2" style={{ height: ALTURA_CONTAINER }}>
        {categorias.map((categoria, categoriaIndex) => (
          <div key={categoria} className="flex min-w-16 flex-col items-center gap-2">
            <div className="relative w-full flex-1">
              <div className="absolute inset-x-0 border-t border-border" style={{ top: offsetZero }} />
              <div
                className="absolute inset-x-0 flex items-end justify-center gap-1"
                style={{ top: 0, height: offsetZero }}
              >
                {series.map((serie, serieIndex) => {
                  const valor = valores[serieIndex]?.[categoriaIndex] ?? 0;
                  const altura = valor > 0 ? (valor / amplitude) * ALTURA_CONTAINER : 0;
                  return (
                    <div
                      key={serie.label}
                      className={`w-4 rounded-t-sm ${serie.color}`}
                      style={{ height: altura }}
                      title={`${serie.label}: ${formatCurrency(valor)}`}
                    />
                  );
                })}
              </div>
              <div
                className="absolute inset-x-0 flex items-start justify-center gap-1"
                style={{ top: offsetZero, bottom: 0 }}
              >
                {series.map((serie, serieIndex) => {
                  const valor = valores[serieIndex]?.[categoriaIndex] ?? 0;
                  const altura = valor < 0 ? (-valor / amplitude) * ALTURA_CONTAINER : 0;
                  return (
                    <div
                      key={serie.label}
                      className={`w-4 rounded-b-sm opacity-60 ${serie.color}`}
                      style={{ height: altura }}
                      title={`${serie.label}: ${formatCurrency(valor)}`}
                    />
                  );
                })}
              </div>
            </div>
            <span className="font-mono text-[0.65rem] text-muted-foreground">{categoria}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        {series.map((serie) => (
          <div key={serie.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${serie.color}`} />
            {serie.label}
          </div>
        ))}
      </div>
    </div>
  );
}
