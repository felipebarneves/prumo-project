# Playbook 03: Sistema Padrão de Construção de SaaS & Estrutura de PRD

> Estrutura modular, gerenciamento com `pnpm` e especificação detalhada de produto para a Neves Soluções.

---

## 📂 Estrutura Padrão do Monorepo

```
/prumo-project
├── CLAUDE.md                      ← Contexto global lido pelo Claude Code
├── brand-identity.md              ← Guia mestre da marca (Cores, Fontes, Tom de voz)
├── playbook_dev_agents.md
├── playbook_supabase_migrations.md
├── Pplaybook_saas_architecture.md
├── /docs
│   ├── /handoff                   ← Insumo da Fase 1 (Claude Chat) — input para o Nexus, nunca output
│   │   └── /[modulo]              ← Pasta do módulo (ex: /viabilidade)
│   │       ├── 00-indice-handoff.md          ← Mapa de leitura e dependências cruzadas entre os documentos
│   │       ├── minuta-requisitos-comercial.md
│   │       ├── resumo-construcao-telas.md
│   │       └── tela-[01..N]-[nome-da-tela].md
│   ├── /prd
│   │   └── /[modulo]              ← Pasta do módulo (ex: /viabilidade)
│   │       ├── 00-overview.md
│   │       ├── 01-database-schema.md
│   │       ├── 01b-business-rules-engine.md
│   │       ├── 02-backend-api.md
│   │       ├── 03-frontend-ux.md
│   │       ├── 04-auth-integrations.md
│   │       └── 05-deploy-ops.md
│   ├── /architecture              ← Contratos REST e diagramas do Atlas
│   └── /qa                        ← Relatórios de testes do Sentinel
├── /supabase
│   └── /migrations                ← Migrações versionadas (00001, 00002...)
├── /apps
│   ├── /api                       ← Backend FastAPI (Python)
│   └── /web                       ← Frontend Next.js + Tailwind (App Router)
├── pnpm-workspace.yaml            ← Configuração de Monorepo do pnpm
└── .env.example
```

---

## 🎨 Design System e Identidade Visual (`brand-identity.md`)

- **Fundo Base:** Dark First (`#07111F` / `--bg`)
- **Superfície Cards:** `#0B1929` (`--bg-card`)
- **Cor de Acento (Uso Escasso):** Dourado Gradiente (`--gold-grad: linear-gradient(135deg, #C8883A 0%, #E8A855 100%)`)
- **Tipografia:**
  * Titles/Headings: `Space Grotesk`
  * Body: `DM Sans`
  * Code/Mono/Stats: `JetBrains Mono`

**Regra Estrita:** O Claude Design ou referências visuais servem apenas para exploração. O código de produção é escrito pela **Nova** em `apps/web`, consumindo as variáveis CSS globais configuradas em `globals.css`.

---

## 📥 Estrutura de Handoff da Fase 1 (`docs/handoff/[modulo]/`)

Antes de o Nexus gerar o PRD oficial de um módulo, existe uma etapa de análise crítica (Fase 1) conduzida em Claude Chat — desafio de premissas, questionamento de escopo e especificação tela a tela, registrada em documentos Markdown. Esses documentos são o **input** do Nexus, nunca o seu output, e por isso vivem numa pasta própria, separada de `docs/prd/[modulo]/`:

- **`00-indice-handoff.md`:** mapa de leitura dos demais documentos do módulo — ordem recomendada e dependências cruzadas entre eles (ex: uma decisão tomada num documento que afeta retroativamente outro já fechado). Deve ser o primeiro arquivo lido pelo Nexus dentro da pasta.
- **`minuta-requisitos-comercial.md`:** estrutura de planos, capacidade por tier, gatekeeping por assinatura — quando a discussão comercial precede ou é transversal ao módulo.
- **`resumo-construcao-telas.md`:** decisões gerais fechadas antes da especificação tela a tela (regras de negócio, modelo de dados, integrações).
- **`tela-[NN]-[nome-da-tela].md`:** uma especificação por tela, na ordem de dependência estrutural (não a ordem final de navegação do usuário) — cada uma serve de input direto a um ou mais dos 7 arquivos do PRD oficial.

**Regra de fronteira (não confundir as duas pastas):**
- `docs/handoff/[modulo]/` = entrada da Fase 1, produzida em Claude Chat, referenciando decisões e telas.
- `docs/prd/[modulo]/` = saída oficial do Nexus, os 7 arquivos padrão descritos na seção seguinte.

O Nexus deve **ler** a pasta `handoff` como fonte de verdade de negócio, mas nunca escrever nela — qualquer atualização de escopo depois do handoff inicial (ex: uma tela reaberta para revisão) deve ser refeita em Claude Chat e o arquivo correspondente substituído na pasta `handoff`, não editado diretamente a partir do PRD.

---

## 📄 Estrutura Completa de Especificação dos Módulos (PRD)

Para cada módulo criado, o agente **Nexus (PM)** deve gerar a pasta `docs/prd/[modulo]/` contendo estritamente os 7 arquivos abaixo. Isso previne diluição de contexto e impede que a IA invente regras de negócio.

### 1. `00-overview.md` (Visão Geral & Escopo)
- Problema central que o módulo resolve e proposta de valor.
- Personas/Usuários-alvo e seus *Jobs-to-be-Done*.
- Métricas de sucesso do módulo.
- **Limites Claros:** O que está dentro da v1 (MVP) e o que está **fora do escopo**.

### 2. `01-database-schema.md` (Modelagem do Banco & RLS)
- Diagrama relacional e definição exata de tabelas, colunas, tipos de dados e FKs.
- **Modelagem de Faturamento:** Mapeamento de `stripe_customer_id`, `stripe_subscription_id` e `subscription_status` na tabela de organizações.
- Definição explícita de índices de performance.
- Regras de **Row Level Security (RLS)** para isolamento entre tenants (PMEs).

### 3. `01b-business-rules-engine.md` (Motor de Cálculo & Regras Financeiras)
- *Obrigatório para SaaS financeiro/analítico.*
- Fórmulas matemáticas puras, algoritmos de cálculo, regras tributárias e simulações.
- Casos de borda (arredondamento, divisão por zero, valores negativos).
- Cenários de teste com valores de entrada e saídas esperadas para testes de regressão.

### 4. `02-backend-api.md` (Contratos de API & Webhooks)
- Especificação dos endpoints FastAPI (Método, URL, Headers).
- Schemas Pydantic de Request Body e Response Body (HTTP 200, 400, 401, 422, 500).
- **Endpoints de Checkout & Webhooks Stripe:** 
  * POST `/api/v1/billing/create-checkout-session`
  * POST `/api/v1/billing/portal`
  * POST `/api/v1/stripe/webhook` (Tratamento dos eventos `customer.subscription.updated`, `invoice.payment_failed`, etc).

### 5. `03-frontend-ux.md` (Interface, Fluxos & Componentes)
- Inventário de telas e sub-rotas no Next.js (`apps/web`).
- Fluxo de navegação do usuário passo a passo.
- Estados de UI: Carregamento (*Skeleton*), Erro, Estado Vazio (*Empty State*) e Sucesso.
- Mapeamento de componentes reutilizáveis baseados no `brand-identity.md`.

### 6. `04-auth-integrations.md` (Autenticação, RBAC & Gatekeeping)
- Modelo de Autenticação (Supabase Auth).
- Matriz de Permissões (Roles: Admin, Analista, Leitor).
- **Gatekeeping por Assinatura (Paywall Interno):** Bloqueio de funcionalidades ou restrição de criação de novos projetos com base no status do Stripe (`active`, `past_due`, `inactive`).

### 7. `05-deploy-ops.md` (Variáveis de Ambiente & Operações)
- Lista exata de variáveis de ambiente necessárias (`.env` local, Vercel e FastAPI).
- Mapeamento das chaves do Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`).
- Procedimentos de verificação de build e monitoramento da aplicação.
