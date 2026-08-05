# Playbook de Migrations do Supabase — Padrão de Banco de Dados & RLS

> Diretrizes para versionamento, nomenclatura e segurança do Postgres/Supabase no Monorepo Prumo.

---

## 🛢️ Regras de Ouro
1. **Fonte da Verdade:** Toda e qualquer alteração de banco DEVE ser um arquivo `.sql` na pasta `supabase/migrations/`.
2. **Zero Alteração Manual Silenciosa:** Nunca altere tabelas diretamente pelo Dashboard do Supabase sem salvar a SQL equivalente em `supabase/migrations/`.
3. **Imutabilidade:** Se precisar alterar uma coluna que já foi para produção, crie um arquivo de migração NOVO (`00003_...sql`). Nunca edite migrações antigas aplicadas.

---

## 📁 Estrutura de Nomenclatura

Use numeração sequencial ou timestamps legíveis:
- `00001_initial_schema.sql` (Tabelas base: organizacoes, usuarios, perfis)
- `00002_stripe_schema.sql` (Atributos de faturamento: stripe_customer_id, subscription_status)
- `00003_prumo_viabilidade_schema.sql` (Tabelas específicas de um módulo)

---

## 🔒 Padrão de SQL & Segurança RLS (Row Level Security)

Sempre estruture o arquivo de migração na seguinte ordem:

```sql
-- 1. Criar Tabela com UUID e Timestamps
CREATE TABLE IF NOT EXISTS public.prumo_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar Índices de Performance
CREATE INDEX IF NOT EXISTS idx_prumo_projects_org_id ON public.prumo_projects(organization_id);

-- 3. Habilitar RLS (OBRIGATÓRIO)
ALTER TABLE public.prumo_projects ENABLE ROW LEVEL SECURITY;

-- 4. Criar Políticas RLS (Isolamento por Organização/Tenant)
CREATE POLICY "Users can access projects of their organization"
ON public.prumo_projects
FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM public.users WHERE auth_id = auth.uid()
    )
);
```

---

## 🛠️ Execução e Aplicação

1. **Via Dashboard Supabase (Produção/Dev Rápido):**
   * Copie o conteúdo do arquivo `supabase/migrations/0000X_...sql`.
   * Vá no **SQL Editor** do Supabase e clique em **Run**.
   * Verifique as tabelas em **Table Editor**.

2. **Via Supabase CLI:**
   ```powershell
   supabase migration new nome_da_mudanca
   supabase db reset      # Testar do zero localmente
   supabase db push       # Enviar alterações pendentes para o banco remoto
   ```
