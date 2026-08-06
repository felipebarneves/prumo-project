# 05 — Variáveis de Ambiente & Operações — Prumo Viabilidade

Deploy em **monolito único** (1 `apps/api` + 1 `apps/web`, hospedados na Vercel) — módulos controlados por feature-flag/entitlement de plano (`plan_tier`), não por aplicações separadas. Apenas BRL no MVP — sem suporte a multi-moeda ou hedge cambial.

---

## 1. Variáveis de Ambiente

### 1.1. `apps/web` (Next.js, Vercel)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase |
| `NEXT_PUBLIC_API_URL` | URL base do backend FastAPI |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chave publicável do Stripe (Checkout/Portal no client) |

### 1.2. `apps/api` (FastAPI, Vercel)

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (bypassa RLS — uso restrito a operações administrativas: aceite de convite por token, resolução de webhooks) |
| `SUPABASE_JWT_SECRET` | Validação de JWT das requisições autenticadas |
| `DATABASE_URL` | Connection string direta ao Postgres (migrations, jobs) |
| `STRIPE_SECRET_KEY` | Chave secreta do Stripe (criação de sessões de checkout/portal) |
| `STRIPE_WEBHOOK_SECRET` | Verificação de assinatura do webhook `/api/v1/stripe/webhook` |
| `FRONTEND_URL` | Usada para montar links de retorno do Stripe Checkout/Portal e links de convite/confirmação de e-mail |

### 1.3. Local (`.env.example`, raiz do monorepo)

Espelha as chaves acima com valores de desenvolvimento/sandbox (Stripe test mode, projeto Supabase local ou de dev).

## 2. Mapeamento das Chaves do Stripe

| Chave | Onde é usada |
|---|---|
| `STRIPE_SECRET_KEY` | `POST /api/v1/billing/create-checkout-session`, `POST /api/v1/billing/portal` |
| `STRIPE_WEBHOOK_SECRET` | `POST /api/v1/stripe/webhook` — valida assinatura antes de processar `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Redirect client-side para o Stripe Checkout/Portal a partir da Tela 9 (Configurações → Plano Atual) |

Sincronização de estado: todo evento de webhook processado deve atualizar `organizations.subscription_status` e, quando aplicável, `organizations.plan_tier` — esta é a única via de escrita desses campos (nunca editados diretamente por endpoint de produto).

## 3. Procedimentos de Verificação de Build

- **Migrations:** toda alteração de schema requer migration versionada em `supabase/migrations/` (`playbook_supabase_migrations.md`), aplicada antes do deploy do backend que a consome.
- **Backend (`apps/api`):** suíte `pytest` cobrindo os cenários de regressão de `01b-business-rules-engine.md` (seção 10) deve passar antes de merge — nenhuma regra de cálculo financeiro é validada apenas manualmente.
- **Frontend (`apps/web`):** build Next.js (`next build`) sem erros de tipo; validar que nenhuma lógica de cálculo financeiro, permissão de papel ou gatekeeping de plano foi implementada no client (auditoria do Sentinel antes do deploy, conforme `CLAUDE.md`).
- **RLS:** rodar `get_advisors` (Supabase) após qualquer migration que toque tabelas do módulo, para detectar políticas ausentes ou tabelas sem RLS habilitado.

## 4. Monitoramento

- Logs de erro do backend (FastAPI, Vercel Functions) monitorados para falhas em: validação de limite de plano, gatekeeping de `subscription_status`, processamento de webhook Stripe (falha aqui pode dessincronizar `subscription_status` e travar/liberar acesso incorretamente).
- Alertas de falha no webhook `/api/v1/stripe/webhook` são críticos — tratam diretamente o gatekeeping de escrita (`past_due`/`inactive`) descrito em `04-auth-integrations.md`.
- Métricas de uso de capacidade (Contratos Ativos, Usuários) por organização, para embasar upsell e detectar organizações próximas do limite do tier.
