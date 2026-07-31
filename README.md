# prumo-project

Monorepo do projeto Prumo, organizado para suportar frontend, backend, bibliotecas compartilhadas, infraestrutura de banco e automações de CI/CD.

## Estrutura do repositório

```text
prumo-project/
├── .claude/                   # Prompts de sistema dos agentes
├── docs/                      # Artefatos e handoffs gerados
│   ├── prd/
│   ├── architecture/
│   └── qa/
├── apps/                      # Aplicações principais
│   ├── web/                   # Frontend Next.js
│   └── api/                   # Backend FastAPI
├── packages/                  # Pacotes compartilhados
│   ├── ui/                    # Componentes reutilizáveis
│   └── config/                # Configurações compartilhadas
├── supabase/                  # Banco, migrations e seeds
│   ├── migrations/
│   └── seed.sql
├── .github/workflows/         # Pipelines CI/CD
└── CLAUDE.md                  # Guia principal do repositório
```

## Objetivo

Este monorepo centraliza:
- aplicação web;
- API e motor de cálculo;
- componentes e configs compartilhadas;
- infraestrutura de banco com Supabase;
- documentação técnica e funcional;
- workflows de automação e CI/CD.

## Convenções

- `apps/` contém aplicações executáveis.
- `packages/` contém código compartilhado entre apps.
- `docs/` armazena documentos e handoffs produzidos durante o desenvolvimento.
- `supabase/` concentra migrations e seed de banco.
- `.github/workflows/` contém automações do repositório.
- `.claude/` concentra prompts e definições operacionais dos agentes.

## Setup inicial

### 1. Clonar o repositório
```bash
git clone https://github.com/felipebarneves/prumo-project.git
cd prumo-project
```

### 2. Configurar variáveis de ambiente
Crie arquivos `.env` conforme a necessidade de cada app, sem versioná-los.

Sugestão:
- `apps/web/.env.local`
- `apps/api/.env`
- `supabase/.env` (se aplicável ao seu fluxo)

### 3. Subir os projetos
Os comandos reais de inicialização serão definidos conforme o bootstrap de cada app (`web`, `api`, `packages`).

## Próximos passos

- adicionar o workspace manager do monorepo;
- inicializar o app `web` com Next.js;
- inicializar o app `api` com FastAPI;
- configurar lint, format e padrões compartilhados em `packages/config`;
- configurar CI em `.github/workflows/ci.yml`;
- definir onboarding técnico em `CLAUDE.md`.

## Observações

Este repositório foi estruturado para crescimento modular. A prioridade é manter separação clara entre aplicações, pacotes compartilhados, infraestrutura e documentação.