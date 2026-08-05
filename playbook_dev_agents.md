# Playbook Operacional — Orquestração de Agentes Claude Code

> Documento de referência para o fluxo sequencial de desenvolvimento de módulos SaaS no **Prumo Monorepo**.
> Otimizado para leitura no **Obsidian** e execução direta no terminal.

---

## 🧭 Visão Geral do Fluxo dos Agentes

```
  ┌──────────────────┐
  │  1. NEXUS (PM)   │ ➔ Gera docs/prd/[modulo].md
  └────────┬─────────┘
           ▼
  ┌──────────────────┐
  │ 2. ATLAS (Arq)   │ ➔ Gera SQL Migrations (supabase/migrations/) e Contratos REST
  └────────┬─────────┘
           ▼
  ┌──────────────────┴──────────────────┐
  │                                     │
  ▼                                     ▼
┌────────────────────┐        ┌────────────────────┐
│ 3A. KAISER (Back)  │        │  3B. NOVA (Front)  │
└─────────┬──────────┘        └─────────┬──────────┘
          │                             │
          └──────────────────┬──────────┘
                             ▼
                    ┌──────────────────┐
                    │ 4. SENTINEL (QA) │ ➔ Audita RLS e executa testes
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ 5. PULSE (DevOps)│ ➔ CI/CD, Git e Deploy Vercel
                    └──────────────────┘
```

| Fase   | Agente                | Papel & Atuação                                    | Artefato Gerado                               |
| :----- | :-------------------- | :------------------------------------------------- | :-------------------------------------------- |
| **1**  | **Nexus** (PM)        | Especificação de Requisitos e Visão de Produto     | `docs/prd/[modulo].md`                        |
| **2**  | **Atlas** (Arquiteto) | Schemas de Banco, RLS e Contratos de API           | `supabase/migrations/` & `docs/architecture/` |
| **3A** | **Kaiser** (Backend)  | Motor Financeiro Python / FastAPI                  | `apps/api/app/modules/`                       |
| **3B** | **Nova** (Frontend)   | Interface Next.js / Tailwind (`brand-identity.md`) | `apps/web/src/app/(dashboard)/`               |
| **4**  | **Sentinel** (QA)     | Auditoria de RLS, Testes Unitários e Qualidade     | `docs/qa/report-[modulo].md`                  |
| **5**  | **Pulse** (DevOps)    | CI/CD, Pipeline GitHub Actions, Git e Vercel       | `.github/workflows/ci.yml`                    |

---

## 💻 Comandos no Terminal (PowerShell + pnpm)

### Execução Local dos Servidores
```powershell
# Instalar dependências no monorepo (se houver alteração de pacotes)
pnpm install

# Subir Backend (Terminal 1)
cd apps/api
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload

# Subir Frontend (Terminal 2)
cd apps/web
pnpm dev
```

### Passo 1: Especificação de Produto (Nexus - PM)
```powershell
claude --prompt "@.claude/nexus-pm.md Crie a especificação (PRD) do novo módulo [Nome do Módulo]. Detalhe as telas, regras financeiras, entradas/saídas e permissões dos perfis de usuário."
```

### Passo 2: Arquitetura & Banco de Dados (Atlas - Arquiteto)
```powershell
claude --prompt "@.claude/atlas-architect.md Leia o PRD em docs/prd/[modulo].md. Gere o arquivo SQL de migração com tabelas e políticas RLS em supabase/migrations/ e defina os schemas de endpoints FastAPI."
```

### Passo 3A: Backend (Kaiser - Backend)
```powershell
claude --prompt "@.claude/kaiser-backend.md Desenvolva o módulo de backend em apps/api/app/modules/[modulo] seguindo a especificação do Atlas. Crie os schemas Pydantic, serviços de cálculo e rotas FastAPI."
```

### Passo 3B: Frontend (Nova - Frontend)
```powershell
claude --prompt "@.claude/nova-frontend.md Crie as páginas do módulo em apps/web/src/app/(dashboard)/[modulo] usando Next.js. Garanta conformidade total com o brand-identity.md (tema escuro, detalhes em dourado e tipografia do sistema)."
```

### Passo 4: Auditoria de Qualidade (Sentinel - QA)
```powershell
claude --prompt "@.claude/sentinel-qa.md Faça a auditoria do módulo [modulo]. Execute os testes automatizados da API, verifique as regras de RLS do Supabase e garanta que não existem falhas de segurança entre tenants."
```

### Passo 5: Git & Deploy (Pulse - DevOps)
```powershell
# Sincronização com o GitHub
git status
git add .
git commit -m "feat([modulo]): adiciona novo modulo [nome-do-modulo]"
git push origin main
```

---

## 💳 Integração & Atualização de Planos no Stripe

1. **Variáveis de Ambiente (`.env`):**
   * **Backend (`apps/api/.env`):** `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`
   * **Frontend (`apps/web/.env.local`):** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
2. **IDs dos Produtos e Planos:**
   Ao cadastrar um plano no dashboard do Stripe, salve a chave do preço gerada no `.env`:
   ```env
   NEXT_PUBLIC_STRIPE_PRICE_VIABILIDADE_MONTHLY=price_1Nxxxxxxxxxxxxxx
   ```
