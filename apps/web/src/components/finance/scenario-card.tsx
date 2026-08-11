import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScenarioCardStatus {
  label: string;
  variant?: "default" | "secondary" | "outline" | "destructive";
}

interface ScenarioCardProps {
  title: ReactNode;
  status?: ScenarioCardStatus | ScenarioCardStatus[];
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Card padrão das telas de Cenários — título/badges de status no cabeçalho,
 * corpo livre (`children`) e rodapé opcional de ações. Mesmo padrão de borda/
 * padding do `MetricCard` (`--radius-lg`, `border-border/60`).
 */
export function ScenarioCard({ title, status, children, footer, className }: ScenarioCardProps) {
  const statuses = status ? (Array.isArray(status) ? status : [status]) : [];

  return (
    <Card className={cn("overflow-hidden rounded-[var(--radius-lg)] border-border/60", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">{title}</div>
        {statuses.length > 0 ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {statuses.map((s, i) => (
              <Badge key={i} variant={s.variant ?? "secondary"}>
                {s.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 pt-4">{children}</CardContent>
      {footer ? <CardFooter className="border-t-0 bg-transparent px-(--card-spacing) pt-0">{footer}</CardFooter> : null}
    </Card>
  );
}
