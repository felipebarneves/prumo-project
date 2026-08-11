import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardStatus {
  label: string;
  variant?: "default" | "secondary" | "outline" | "destructive";
}

interface MetricCardProps {
  label: string;
  value: string;
  secondary?: string;
  status?: MetricCardStatus;
  className?: string;
}

/**
 * Card de estatística no padrão de marca — número em gradiente dourado (`text-gold-gradient`,
 * globals.css), label pequeno em mono uppercase (brand-identity.md, seção 6: "Padrões de prova").
 * Suporta um badge de status opcional no canto superior direito (ex.: "Ativo", "v2").
 */
export function MetricCard({ label, value, secondary, status, className }: MetricCardProps) {
  return (
    <Card className={cn("border-border/60 bg-card/60 py-4", className)}>
      <CardHeader className="flex-row items-start justify-between gap-1 space-y-0 px-4">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
        {status ? (
          <Badge variant={status.variant ?? "secondary"} className="shrink-0">
            {status.label}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-gold-gradient font-[var(--font-display)] text-2xl font-bold leading-tight">{value}</p>
        {secondary ? <p className="mt-1 text-xs text-muted-foreground">{secondary}</p> : null}
      </CardContent>
    </Card>
  );
}
