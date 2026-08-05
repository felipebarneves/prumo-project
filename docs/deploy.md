# Deploy — Ecossistema Prumo

**Autor:** Agente Pulse (DevOps)
**Escopo desta rodada:** módulo Viabilidade (`apps/api`, `apps/web`, `supabase/migrations`), já aprovado pelo Sentinel (`docs/qa/qa-report-viabilidade.md`).

---

## 1. Estado atual (verificado nesta rodada)

| Item | Status |
|---|---|
| Migrações Supabase (`00001`–`00003`) | ✅ Já aplicadas no projeto remoto `prumo-project` (`zqjbtqztryhxecuiipnx`) — `supabase migration list` mostra local e remoto sincronizados. Nenhuma ação necessária. |
| Testes backend (`pytest`) | ✅ 68/68 passando |
| Lint + type-check + build frontend | ✅ limpos |
| `apps/api/requirements.txt` | 🔧 Corrigido nesta rodada — estava salvo em UTF-16, o que quebraria tanto `pip` em CI quanto o builder Python da Vercel. Reescrito em UTF-8. |
| CI (`.github/workflows/ci.yml`) | 🔧 Estava vazio — criado nesta rodada (seção 2) |
| `vercel.json` (raiz e `apps/api/`) | 🔧 Criados nesta rodada (seção 3) |
| `.env.example` (`apps/api/`, `apps/web/`) | 🔧 Criados nesta rodada (seção 4) |
| Deploy real em produção (Vercel) | ⛔ **Não executado nesta rodada** — ver seção 5 |

---

## 2. CI/CD (`.github/workflows/ci.yml`)

Dois jobs paralelos + um gate de agregação:

- **backend**: Python 3.11, instala `apps/api/requirements.txt` + `pytest`, roda `pytest tests/ -v --cov=app`.
- **frontend**: pnpm 10.13.1 + Node 22, `pnpm install --frozen-lockfile`, lint, `tsc --noEmit`, `pnpm --filter web build` (com variáveis `NEXT_PUBLIC_*` placeholder — build-time apenas, nunca segredos reais).
- **ci-status**: falha se qualquer um dos dois anteriores falhar — use este job como *required check* na proteção da branch `main` no GitHub (Settings → Branches → Branch protection rules), em vez de exigir `backend`/`frontend` individualmente. Isso evita ter que atualizar a regra toda vez que um novo job for adicionado ao pipeline.

Dispara em `push`/`pull_request` para `main`. Recomenda-se configurar a branch protection do GitHub para exigir o check `CI Status` antes de permitir merge — isso é o que torna concreta a regra do playbook ("nenhum merge sem os testes do Kaiser e da Nova passando").

---

## 3. Roteamento Vercel (`vercel.json`)

Duas estratégias documentadas — **a recomendada é a Opção A**, pois não exige nenhuma alteração em código de aplicação (Next.js ou FastAPI) e evita o acoplamento de cold-start entre o runtime Python e os assets estáticos do Next.

### Opção A (recomendada): dois projetos Vercel separados

1. Criar dois projetos na Vercel a partir do mesmo repositório GitHub (`felipebarneves/prumo-project`):
   - **`prumo-web`**: Root Directory = `apps/web`. Framework preset: Next.js (detectado automaticamente). Usa apenas o `package.json`/`next.config.ts` do próprio diretório — nenhum `vercel.json` extra necessário aqui.
   - **`prumo-api`**: Root Directory = `apps/api`. Framework preset: "Other". Usa `apps/api/vercel.json` (criado nesta rodada), que aponta `@vercel/python` para `index.py` e roteia **todo** o tráfego (`/(.*)`) para lá — inclusive `/health`, que ficaria inacessível na Opção B (ver abaixo).
2. Definir `NEXT_PUBLIC_API_URL` no projeto `prumo-web` como a URL pública do deploy de `prumo-api` (ex.: `https://prumo-api.vercel.app`).
3. Cada projeto ganha seu próprio ciclo de deploy/rollback independente — uma regressão na API não derruba o site, e vice-versa.

### Opção B: um único projeto (raiz do monorepo), roteamento combinado

`vercel.json` na raiz (criado nesta rodada) usa o formato legado `builds`/`routes` da Vercel para compor `@vercel/python` (via `apps/api/index.py`) e `@vercel/next` (via `apps/web/package.json`) num único deploy, roteando `/api/*` para o FastAPI e delegando o restante ao Next (o builder do Next injeta suas próprias rotas automaticamente depois das que declaramos).

**Limitação conhecida desta opção:** a rota `/health` do FastAPI (`apps/api/app/api/routes/health.py`) não está sob o prefixo `/api/`, então nesta configuração ela nunca é alcançada — cairia no roteamento do Next.js e retornaria 404. Isso não afeta o módulo Viabilidade (todas as rotas já vivem sob `/api/v1/...`), mas health checks externos (uptime monitors) devem apontar para outra rota, ou a Opção A deve ser usada. Não alterei `health.py` para resolver isso, por estar fora do escopo de infraestrutura (é código do Kaiser).

`apps/api/index.py` foi criado como o entrypoint exigido pela Vercel Python Runtime (reexporta `app` de `app/main.py` sem tocar no código de aplicação).

---

## 4. Variáveis de Ambiente

Modelos criados: `apps/api/.env.example` e `apps/web/.env.example` (nomes de variáveis documentados, nenhum valor real). Configurar as mesmas chaves como **Environment Variables** de cada projeto Vercel (Settings → Environment Variables), separadas por ambiente (Production/Preview/Development):

| Projeto | Variável | Segredo? |
|---|---|---|
| `prumo-api` | `SUPABASE_URL` | Não |
| `prumo-api` | `SUPABASE_SERVICE_ROLE_KEY` | **Sim — nunca no frontend** |
| `prumo-api` | `STRIPE_SECRET_KEY` | **Sim** |
| `prumo-api` | `STRIPE_WEBHOOK_SECRET` | **Sim** |
| `prumo-web` | `NEXT_PUBLIC_SUPABASE_URL` | Não |
| `prumo-web` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Não (protegida por RLS) |
| `prumo-web` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Não |
| `prumo-web` | `NEXT_PUBLIC_API_URL` | Não — URL pública do deploy de `prumo-api` |

Nenhuma chave real foi lida, exposta ou commitada durante esta auditoria — os valores de `.env`/`.env.local` locais foram inspecionados apenas de forma redigida (nomes de variável, nunca conteúdo).

---

## 5. Deploy em Produção — Não Executado Nesta Rodada

Este ambiente de execução **não tem a Vercel CLI instalada nem um token de autenticação Vercel configurado** — não há como este agente disparar `vercel --prod` (ou equivalente) de forma autônoma, e um deploy em produção é uma ação de alto impacto que não deve ser simulada nem presumida como concluída.

**Se os dois projetos Vercel já estiverem conectados a este repositório GitHub** (integração padrão Git da Vercel), o push para `main` feito na etapa anterior (`0f0c976`) **já deve ter disparado deploys automaticamente** — isso é o comportamento default da Vercel e não depende de nenhuma ação adicional deste agente. Confirme no dashboard da Vercel (vercel.com → o projeto → aba Deployments).

**Se os projetos ainda não existem ou não estão conectados**, os próximos passos exigem uma decisão/ação sua (credenciais de conta):

1. `npx vercel login` (ou conectar via dashboard) — requer sua conta Vercel.
2. `npx vercel link` em `apps/web` e em `apps/api` separadamente (Opção A) — ou na raiz (Opção B).
3. Configurar as variáveis de ambiente da seção 4 no dashboard de cada projeto.
4. `npx vercel --prod` em cada diretório (ou deixar o Git integration cuidar disso a cada push em `main`).

Conforme a restrição deste papel ("não realizar deploys manuais em produção sem que os testes e QA tenham passado"): esse gate **já está satisfeito** (seção 1) — o bloqueio restante é puramente de acesso/credencial, não de qualidade.
