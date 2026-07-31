# 🎯 CLAUDE.md - Orquestrador do Repositório (Ecossistema Prumo)

## 📌 Visão Geral do Projeto
Ecossistema Prumo, SaaS B2B modular de análises financeiras (Viabilidade, Precificação, Gestão) para PMEs prestadoras de serviços.

## 🛠️ Stack Tecnológica Global
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, **shadcn/ui** (Hospedado na Vercel).
- **Backend:** Python 3.11+, FastAPI, Pydantic, pytest (Hospedado na Vercel).
- **Banco de Dados & Auth:** Supabase (PostgreSQL + RLS + GoTrue Auth multitenant).
- **CI/CD & Code:** GitHub Actions, Claude Code, Cursor.

## 🤖 Time de Agentes & Papéis
Os prompts específicos de cada agente estão armazenados na pasta `.claude/`:

1. **Nexus (PM):** `.claude/nexus-pm.md` — Criação de PRDs e regras de negócio financeiras.
2. **Atlas (Arquiteto):** `.claude/atlas-architect.md` — Schemas SQL/Supabase, políticas RLS e contratos de API.
3. **Kaiser (Backend):** `.claude/kaiser-backend.md` — Implementação da API em Python e lógica de cálculo.
4. **Nova (Frontend):** `.claude/nova-frontend.md` — Interface Next.js, componentes **shadcn/ui** e integração de API.
5. **Sentinel (QA):** `.claude/sentinel-qa.md` — Auditoria de RLS, segurança e testes matemáticos.
6. **Pulse (DevOps):** `.claude/pulse-devops.md` — Pipelines de CI/CD, deploys e variáveis de ambiente.

## 🔄 Regras de Handoff (Fluxo de Trabalho)
- Nenhum agente de código (Kaiser/Nova) deve iniciar sem uma especificação do **Atlas** em `docs/architecture/`.
- Qualquer alteração na estrutura de dados do banco requer a criação de uma migration no Supabase (`supabase/migrations/`).
- Todo código produzido deve ser validado pelo **Sentinel** antes de ser submetido para deploy pelo **Pulse**.

## 📝 Convenções do Repositório
- **Linguagem padrão de documentação:** Português (PT-BR).
- **Nomes de variáveis/código:** Inglês (EN-US).
- **Commits:** Padrão Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`).