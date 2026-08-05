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
 * regra de "sem estilos inline" (apenas a altura da barra é uma variável
 * calculada em runtime, atribuída via `style` por ser um dado, não uma escolha
 * de estilo).
 */
export function AnnualBarChart({ categorias, series, valores }: AnnualBarChartProps) {
  const maximo = Math.max(1, ...valores.flat().map((v) => Math.abs(v)));

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-4 overflow-x-auto pb-2" style={{ height: 180 }}>
        {categorias.map((categoria, categoriaIndex) => (
          <div key={categoria} className="flex min-w-16 flex-col items-center gap-2">
            <div className="flex h-full items-end gap-1">
              {series.map((serie, serieIndex) => {
                const valor = valores[serieIndex]?.[categoriaIndex] ?? 0;
                const alturaPercentual = (Math.abs(valor) / maximo) * 100;
                return (
                  <div
                    key={serie.label}
                    className={`w-4 rounded-t-sm ${serie.color}`}
                    style={{ height: `${alturaPercentual}%` }}
                    title={`${serie.label}: ${formatCurrency(valor)}`}
                  />
                );
              })}
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
