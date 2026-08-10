import { Clock } from "lucide-react";

export default function HistoricoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-sm text-muted-foreground">Linha do tempo de alterações do projeto.</p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border/60 py-16 text-center">
        <Clock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Em breve</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          A linha do tempo de alterações do projeto está em desenvolvimento.
        </p>
      </div>
    </div>
  );
}
