import { TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface TableContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper padrão de tabela — borda dourada arredondada + scroll horizontal.
 * Centraliza o markup duplicado ad hoc em várias páginas.
 */
export function TableContainer({ children, className }: TableContainerProps) {
  return (
    <div className={cn("max-w-full overflow-x-auto rounded-[var(--radius-lg)] border border-border/60", className)}>
      {children}
    </div>
  );
}

type TableHeaderGoldProps = React.ComponentProps<typeof TableHeader>;

/**
 * Substituto drop-in de `TableHeader` com o cabeçalho dourado da marca
 * (`[&>th]:text-primary`). Cobre o caso comum de uma única `TableRow` no cabeçalho.
 */
export function TableHeaderGold({ className, children, ...props }: TableHeaderGoldProps) {
  return (
    <TableHeader className={className} {...props}>
      <TableRow className="[&>th]:text-primary">{children}</TableRow>
    </TableHeader>
  );
}
