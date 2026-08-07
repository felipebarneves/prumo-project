import { Settings } from "lucide-react";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Preferências do projeto.</p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border/60 py-16 text-center">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Em breve</p>
        <p className="max-w-sm text-sm text-muted-foreground">Esta tela está em desenvolvimento.</p>
      </div>
    </div>
  );
}
