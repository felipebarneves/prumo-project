import { TableHead } from "@/components/ui/table";
import { formatMesAno } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MonthTableHeadProps {
  mes: number;
  dataInicio: string | null | undefined;
  className?: string;
}

/**
 * Cabeçalho de coluna de mês relativo — "Mês N" na linha principal e, logo
 * abaixo em texto secundário menor, o mês/ano correspondente (ex: "out/26"),
 * calculado a partir de `data_inicio` do contrato. Usado em Cronograma, DRE
 * Detalhada e Fluxo de Caixa — as três tabelas com colunas por "Mês N" (o
 * Resumo da DRE já usa `periodo_label` pré-formatado pela API, sem necessidade
 * deste componente).
 */
export function MonthTableHead({ mes, dataInicio, className }: MonthTableHeadProps) {
  return (
    <TableHead className={cn("text-right", className)}>
      <div className="leading-tight">Mês {mes}</div>
      <div className="text-[0.65rem] font-normal normal-case leading-tight text-muted-foreground">
        {formatMesAno(dataInicio, mes)}
      </div>
    </TableHead>
  );
}
