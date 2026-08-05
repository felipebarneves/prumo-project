import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  secondary?: string;
  className?: string;
}

/**
 * Card de estatística no padrão de marca — número em gradiente dourado (`text-gold-gradient`,
 * globals.css), label pequeno em mono uppercase (brand-identity.md, seção 6: "Padrões de prova").
 */
export function KpiCard({ label, value, secondary, className }: KpiCardProps) {
  return (
    <Card className={cn("border-border/60 bg-card/60 py-4", className)}>
      <CardHeader className="gap-1 px-4">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-gold-gradient font-[var(--font-display)] text-2xl font-bold leading-tight">{value}</p>
        {secondary ? <p className="mt-1 text-xs text-muted-foreground">{secondary}</p> : null}
      </CardContent>
    </Card>
  );
}
