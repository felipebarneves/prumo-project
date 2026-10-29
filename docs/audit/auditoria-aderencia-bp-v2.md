# Auditoria de Aderência — Prumo Viabilidade × Business Plan v2

> **Autores:** Atlas (Arquiteto) + Sentinel (QA) — auditoria **somente leitura**.
> **Data:** 2026-10-29 · **Base:** `main` @ `1aa40be`
> **Escopo:** `supabase/migrations/`, `apps/api/`, `apps/web/`, `.github/workflows/`, `vercel.json`, `docs/`.
> Todas as estimativas de esforço são **estimativas do auditor** (S < 2h, M 2–8h, L > 8h), sem testes de carga nem acesso ao banco de produção.
> Referências `arquivo:linha` se referem ao commit acima. "Não encontrado" significa que a busca no código versionado não retornou nada.

---

## 1. Resumo executivo

**Veredito:** o **motor de cálculo e o isolamento por tenant estão sólidos e podem ser reaproveitados**. A **camada comercial** (planos, módulos, billing, provisionamento) foi construída para o modelo antigo de 4 tiers + Stripe e está, na prática, **incompleta mesmo para esse modelo**: ninguém grava `subscription_status`, não há como criar uma organização nem o 1º Owner, e o convite não chega ao convidado (não é enviado e não tem tela de aceite). A boa notícia é que os números de capacidade do BP v2 já batem com 3 das 4 linhas de `plan_capacities`. Por isso, adaptar a camada comercial custa mais ou menos o mesmo que terminá-la. Estimativa total para aderir ao BP v2: **~60–90h** (estimativa).

**Os 3 maiores riscos:**
1. **Não existe onboarding de cliente.** Não há endpoint, script nem seed para criar uma organização ou o 1º Owner (`supabase/seed.sql` está vazio). O convite não devolve o token e não envia e-mail (`schemas/convites.py:38-43`), e o web não tem rota de aceite (`apps/web/src/app/` só tem `login`, `esqueci-senha`, `gestao`, `precificacao`, `(dashboard)`). Sem back-office, nenhum cliente entra no produto sem SQL manual.
2. **O contrato mestre está acoplado ao Viabilidade.** Rotas em `modules/viabilidade/`, colunas obrigatórias específicas de Viabilidade (`00003_viabilidade_schema.sql:116-119`), versão criada junto com o contrato (`routes_contratos.py:50`) e funções RLS `viabilidade_*`. Isso bloqueia o cenário "Gestão sem Viabilidade".
3. **O billing não tem fonte de verdade.** Nada grava `subscription_status` (sem webhook, sem endpoint, `verify_organization_subscription` é código morto). Um valor novo como `trialing` derruba **todas** as rotas com erro 500 (`deps.py:90` converte para um Enum fechado).

**Bugs encontrados durante a auditoria (fora do escopo do BP v2, mas bloqueantes):**
- `POST /contratos/{id}/arquivar` **grava o arquivamento e depois responde 500**. `routes_contratos.py:122` coloca `"viabilidade"` em `modulos_afetados`, mas o schema só aceita `precificacao|gestao` (`schemas/contratos.py:91`, `schemas/common.py:60-62`). Reproduzido localmente: `ValidationError: Input should be 'precificacao' or 'gestao'`.
- `00003_viabilidade_schema.sql:32-33`: o `;` antes de `ON CONFLICT` deixa o `ON CONFLICT` como statement isolado, ou seja, erro de sintaxe. A migration não roda limpa num banco novo, e o banco de produção provavelmente diverge do arquivo.

---

## 2. Tabela de aderência

| # | Item | Status | Evidência (arquivo:linha) | Esforço (estimativa) | Observação |
|---|---|---|---|---|---|
| 1a | Definição de planos | **divergente** | `00003_viabilidade_schema.sql:15` (ENUM `plan_tier` com 4 valores); `:21-33` (tabela `plan_capacities`); `:36` (`organizations.plan_tier`); `schemas/common.py:81-85`; `apps/web/src/lib/types/viabilidade.ts:31`; `configuracoes/page.tsx:35-38` | M | Os limites estão numa **tabela** (bom), indexada por um **ENUM** de 4 tiers. Starter (1/2/5), `pro_planejamento` (2/3/12) e master (3/7,25) **já batem** com Starter/Pro/Master do BP v2. É preciso renomear `pro_planejamento` para `pro`, aposentar `pro_execucao` e adicionar `max_modules`. Num ENUM do Postgres não dá para remover nem renomear valor sem recriar o tipo (o próprio time já esbarrou nisso em `00004:5-11`). |
| 1b | Override por organização e adicionais | **ausente** | `organizations` não tem coluna de limite (`00001:9-14`, `00002:2-5`, `00003:35-36`); `repository.py:40-42` lê **só** `plan_capacities` pelo tier | M | **Não dá para fazer sem migration.** Faltam colunas ou uma tabela para os adicionais (executor/viewer/contrato extra) e para override manual. A leitura do limite está centralizada em `get_plan_capacity`, então o ponto de mudança no backend é um só. |
| 1c | Aplicação do limite de usuários | **divergente** | `routes_convites.py:48-56` (conta só membros **aceitos** do papel); `repository.py:45-53`; `routes_convites.py:99-165` (o aceite **não** revalida o limite) | S | Convites pendentes não contam no limite, e o aceite não revalida. O Owner pode criar N convites acima do limite e todos podem ser aceitos. O Owner não entra em nenhum limite. |
| 1d | Aplicação do limite de contratos ativos | **ok** (com ressalva) | `routes_contratos.py:40-46` (criar), `:132-138` (desarquivar); `repository.py:102-110` (`arquivado_em IS NULL`) | S | Checagem no backend antes do INSERT, mas sem lock: duas criações simultâneas podem passar do limite (race). Aceitável no MVP. |
| 1e | "Módulos à escolha" | **ausente** | `00001:30` (`active_modules` fica em `organization_members`, **por usuário**, não por org); `repository.py:593` (gravado fixo como `["viabilidade"]`); nenhuma leitura de `active_modules` no código | M | Nenhuma rota verifica se a org contratou o módulo. É preciso um campo de módulos contratados **por organização** e uma dependência `require_module("viabilidade")`. |
| 2a | Leitura de `subscription_status` | **ok** | `deps.py:62` (join em `organizations`), `:90`; `routes_organization.py:76` | — | Lido uma vez por request em `get_current_user`. |
| 2b | Escrita de `subscription_status` | **ausente** | Nenhum UPDATE em `subscription_status` no código. O default é `'inactive'` (`00002:5`) | M (dentro do adaptador Asaas) | Toda org nasce bloqueada para escrita, e só SQL manual libera. |
| 2c | Menções a Stripe | **divergente** | `apps/api/app/core/stripe.py:1-23` (SDK, função `verify_organization_subscription`, **nunca chamada**); `apps/api/requirements.txt:34`; `apps/api/pyproject.toml:19`; `apps/api/.env.example:12-14` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`); `apps/web/package.json:13` (`@stripe/stripe-js`), `:25` (`stripe`); `apps/web/.env.example:9-10`; `00002_stripe_schema.sql:3-9` (`stripe_customer_id`, `stripe_subscription_id`); comentários em `00003:5,593` | S (remoção) | **Webhook: não encontrado. Portal: não encontrado.** A integração Stripe é só o esqueleto, então trocar por Asaas custa pouco do lado da remoção. |
| 2d | Estados de assinatura / trial | **divergente** | `schemas/common.py:88-91` (`active`, `past_due`, `inactive`); coluna `TEXT` sem CHECK (`00002:5`); `deps.py:90` faz `SubscriptionStatus(...)` | S | O banco aceita `trialing` hoje, mas o backend levanta `ValueError` e devolve **500 em todas as rotas autenticadas**. Trial: **não encontrado**. Também não há `trial_ends_at` nem `current_period_end`. |
| 2e | Gate por status | **divergente** | `deps.py:95-108` (só bloqueia **escrita** se status ≠ active); `docs/prd/viabilidade/04-auth-integrations.md:39-41` e `docs/api-spec-viabilidade.md:112-113` (`inactive` deveria bloquear também a leitura, exceto exportação) | S | Hoje `inactive` mantém a leitura liberada. A divergência vem do PRD, mas pode ser a regra desejada no BP v2 (ver Decisões). |
| 2f | Plano anual (15%) | **ausente** | Nenhum campo de ciclo, preço ou desconto | S (dado) / depende do Asaas | Se o Asaas for dono do preço, o produto só precisa de `billing_cycle` para exibir. |
| 3a | Tabela `contratos` (contrato_id mestre) | **ok** | `00003:110-128`; comentário de "source of truth compartilhada" em `:107-109`; `observacoes` em `00005:9-10` | — | Tem um único `id` por org e serve como entidade compartilhada. |
| 3b | Arquivamento | **ok** (com bug) | coluna `arquivado_em` `00003:124,134`; índice `:131`; `routes_contratos.py:115-127` | S | **Bug:** responde 500 depois de gravar (ver Resumo). |
| 3c | Contagem de ativos | **ok** | `repository.py:102-110` | — | Ignora `status_ciclo_vida`: um contrato `perdido_cancelado` não arquivado continua ocupando vaga. |
| 3d | Independência do módulo Viabilidade | **divergente** | Rotas em `apps/api/app/modules/viabilidade/api/routes_contratos.py:22`; colunas NOT NULL específicas de Viabilidade: `duracao_meses`, `prazo_pagamento_dias`, `regime_tributario` (`00003:116-119`); `criar_contrato` cria uma versão de Viabilidade obrigatoriamente (`routes_contratos.py:50`, `schemas/contratos.py:19` `nome_versao` obrigatório); `modulos_afetados` assume Viabilidade (`routes_contratos.py:122`); `contrato_modulo_vinculos.modulo` CHECK `IN ('precificacao','gestao')` (`00003:142`) trata Viabilidade como hub; funções RLS `viabilidade_org_role` / `viabilidade_org_id_for_contrato` (`00003:316-336`); UI só em `/viabilidade` (`apps/web/src/app/(dashboard)/viabilidade/page.tsx:122`) | L | A tabela é quase neutra, mas o **contrato de API e a obrigatoriedade das colunas** amarram o cadastro ao Viabilidade. |
| 4a | "Vincular módulo" (backend) | **divergente** | `routes_contratos.py:143-158` (cria o vínculo e devolve `linhas_importadas_*=0`, com comentário em `:155-157`); `:161-164` desvincular; `repository.py:216-241` | M–L (quando o Precificação existir) | O endpoint existe, mas a importação não. `contrato_origem_id` não tem FK (`00003:143`). |
| 4b | `origem_line_id` | **divergente** | Colunas `00003:204,220`; lock de edição em `routes_linhas.py:76-80,154-158`; badge e disabled na UI (`parametros/page.tsx:410,439,651,688,791,814`) | — | O lock está pronto, mas **nada popula** `origem_line_id`, então é código inerte. Também não checa se o vínculo ainda está ativo (o comentário em `00003:227` diz "enquanto o vínculo estiver ativo"). |
| 4c | Vincular na UI | **ausente** | `apps/web/src/lib/api/viabilidade.ts` não chama `/vinculos`. A UI só **exibe** `modulos_vinculados` (`viabilidade/page.tsx:203-205`) | — | Hoje nenhum fluxo depende de o Precificação existir (`apps/web/src/app/precificacao/page.tsx:1-9` é placeholder). `vinculo_precificacao_ativo` só é exibido (`routes_versoes.py:70-78,85-95`). |
| 5 | Exportação | **ausente** | Nenhuma rota ou lib de PDF/XLSX/CSV na API e no web (busca por `export\|xlsx\|pdf\|csv\|download\|print` sem resultado relevante) | L | O PRD promete exportação liberada em `past_due`/`inactive` (`04-auth-integrations.md:40-43`, `api-spec-viabilidade.md:846`). **Comportamento em past_due/inactive: não aplicável (feature inexistente).** |
| 6a | Criação de organização + 1º Owner | **ausente** | Não há INSERT em `organizations` no código; não há policy de INSERT em `organizations` (`00001:43-64`); `supabase/seed.sql` vazio; convite só aceita `executor`/`viewer` (`00003:58`, `schemas/convites.py:31-35`) | M | Hoje o 1º Owner só nasce com SQL manual em `auth.users` + `profiles` + `organizations` + `organization_members`. |
| 6b | Fluxo de convite | **divergente** | Criação em `routes_convites.py:43-59`; resposta **sem token** (`schemas/convites.py:38-43`); envio de e-mail: **não encontrado**; página de aceite no web: **não encontrada**; aceite (API) em `routes_convites.py:99-165` recusa e-mail já existente (`:120-126`) | M | O backend do aceite está correto e testado (`tests/viabilidade/test_convites.py`), mas o convidado nunca recebe o link. Também faltam reenviar e cancelar (a policy existe em `00003:390-392`, o endpoint não). |
| 6c | Back-office / admin | **ausente** | Papel `admin` existe só no ENUM do banco (`00001:3`, `:62`), não no Python (`schemas/common.py:16-19`) | L | Se alguém tiver `role='admin'`, `deps.py:89` levanta `ValueError` e devolve 500. Não existe conceito de "staff da Prumo". |
| 7 | Home da organização (Tela 8) | **divergente** | API `routes_dashboard.py:108-143`; UI `apps/web/src/app/(dashboard)/viabilidade/home/page.tsx:29-61`; **fora da navegação** (`components/layout/sidebar.tsx:37-47` não tem item Home; `apps/web/src/app/page.tsx:1-10` redireciona para `/viabilidade`) | M | KPIs: Receita Bruta Total, EBITDA Total + Margem, Contratos Ativos "X de limite". Usa a **última versão por `created_at`** (`:119-122`) e **exclui arquivados** (`:111-113`). Não exclui `perdido_cancelado`/`cancelado`. Teto fixo de 1000 contratos (`:112`). Não há lista por contrato com resultado, então a "visão geral dos contratos com resultado consolidado" do BP v2 **não existe**: a Tela 1 lista contratos sem nenhum número financeiro. |
| 8 | Tutorial / ajuda / suporte | **ausente** | Só as mensagens "contate o suporte" (`repository.py:149,349`; `routes_convites.py:134,162`), sem canal | S–M | Não há link de ajuda, onboarding guiado nem contato. |
| 9 | Auditoria de ações sensíveis | **ausente** | Só há "quem criou": `created_by` em `contratos`, `versoes`, `vinculos`, `snapshots` (`00003:125,164,146,301`); `invited_by`/`accepted_by` (`00003:61-62`); `desvinculado_em` (`:145`). Tabela de log: **não encontrada**. `updated_at` sem trigger (busca por `CREATE TRIGGER` sem resultado), então fica congelado no valor de criação | M | Não ficam registrados: exclusão de contrato (`routes_contratos.py:107-112`), exclusão de versão, troca de senha, alteração da org, mudança de plano ou status. |
| 10a | Tabelas sem RLS | **ok** | RLS habilitado em todas as 15 tabelas (`00001:36-38`, `00003:357-368`). `profiles` e `organization_members` têm RLS **sem nenhuma policy** (o cliente anon não acessa) | — | Aceitável porque todo acesso passa pelo backend com service role (`core/supabase.py:8`). Ressalva: como o RLS é contornado, **todo** filtro de tenant depende do backend (`repository.py:1-13`). |
| 10b | Papel e plano: backend ou frontend | **ok** (backend) | `deps.py:95-128`; uso por rota (todas as escritas usam `require_owner_or_executor` ou `require_owner`) | — | O frontend **não** esconde ações por papel: o botão "Convidar Membro" aparece para todos (`configuracoes/page.tsx:297-300`). Isso é UX, não falha de segurança. |
| 10c | Cookies de sessão | **divergente** | `apps/web/src/lib/supabase.ts:3-7` (`createBrowserClient` grava a sessão em `document.cookie`, **não HttpOnly** por construção); token mandado como Bearer (`lib/api/client.ts:125-145`); `middleware.ts`/`proxy.ts`: **não encontrado** | M | Sem middleware não há refresh server-side nem proteção de rota no servidor (só `app/page.tsx` checa o usuário). Flags `Secure`/`SameSite`: os defaults do `@supabase/ssr`, sem configuração explícita. |
| 10d | Headers de segurança | **ausente** | `apps/web/next.config.ts:3-5` vazio; `vercel.json` sem `headers`; FastAPI sem middleware de headers (`main.py:26-32` só CORS, com `allow_methods=["*"]`, `allow_headers=["*"]`) | S | CSP, HSTS, X-Frame-Options e Referrer-Policy: **não encontrados**. |
| 10e | Sessão compartilhada no client service-role | **risco** | `api/routes/auth.py:107-122`: `sign_in_with_password` roda no client **global** de service role, com `sign_out` best-effort | S | O próprio comentário em `:116-118` admite o risco de requisições concorrentes herdarem a sessão. Validar a senha num client isolado. |
| 11a | N+1 | **divergente** | `mapping.py:33,48` (1 query de distribuição **por linha**); `routes_dashboard.py:118-131` (por contrato: versões + 4 listas + N distribuições); `routes_contratos.py:73-74` (vínculos por item da lista); `routes_organization.py:61` (`auth.admin.get_user_by_id` por membro); `repository.py:300-321` (duplicação de versão insere linha a linha) | M | A Home de uma org Master (25 contratos × ~20 linhas) faz ~600+ round-trips HTTP ao PostgREST. |
| 11b | Recálculo por rota | **divergente** | `calcular_projeto` é chamado do zero em cada rota de leitura (`routes_dashboard.py:38,128`; `routes_dre.py`; `routes_fluxo_caixa.py`). Não há cache nem tabela materializada | M | Combinado com o N+1, essa é a principal causa de latência. Cada request também faz `auth.get_user` remoto + query de membro (`deps.py:48,60`). |
| 11c | Região função × banco | **não encontrado** | `vercel.json` e `apps/api/vercel.json` sem `regions`; `docs/deploy.md` não cita região | S | Se a função estiver no default da Vercel (`iad1`) e o Supabase em `sa-east-1`, cada round-trip de 11a cruza o continente. |
| 12a | Testes do motor | **ok** (parcial) | `test_motor.py` (18: IRPJ, DRE mensal, deslocamento de caixa, custo financeiro, despesas); `test_kpi_engine.py` (17: capital de giro `:41-52`, payback `:58-72`, breakeven `:79-89`, VPL `:95-104`, TIR `:110-131`, TIRM `:137-161`); `test_cronograma_engine.py` (10); `test_whatif_engine.py` (6) | S | Falta teste de regressão "planilha de referência → números do motor" ponta a ponta. CI roda `pytest --cov` sem limite mínimo de cobertura (`ci.yml:37`). |
| 12b | Testes de RLS e permissões | **divergente** | `test_security.py` (8 testes de IDOR no repository, com Supabase fake); `test_convites.py` (9) | M | **Não encontrado:** testes de `require_write_access` / `require_roles`, de limite de plano e de policies RLS contra Postgres real. |
| 13 | Telemetria de produto | **ausente** | Busca por `posthog\|gtag\|mixpanel\|@vercel/analytics\|telemetr` sem resultado no código do app | S–M | Só há `console.error` e `logging` técnicos. |

---

## 3. Decisões de arquitetura que precisam ser tomadas

### D1. Como modelar plano, módulos e adicionais
- **A)** Manter o ENUM `plan_tier` e recriá-lo com `starter|pro|master`, adicionar `max_modules` em `plan_capacities` e criar `organization_entitlements` (org_id, módulos contratados, `extra_executors`, `extra_viewers`, `extra_contracts`, `override_*` nullable).
- **B)** Trocar o ENUM por `TEXT` + FK para `plans(code)` (tabela editável pelo back-office) e criar a mesma `organization_entitlements`.
- **C)** Desnormalizar tudo em `organizations` (colunas `max_*` efetivas gravadas pelo back-office).
- **Recomendação: B.** O time já sofreu com ENUM imutável (`00004:5-11`), e o BP pode mudar de novo. O backend passa a calcular `limite_efetivo = override ?? (plano + extras)` num único ponto (substitui `repository.get_plan_capacity`, `repository.py:40`). Esforço: M (estimativa).

### D2. Billing: provedor e estado de assinatura
- **A)** Adaptador `BillingProvider` (interface: `parse_webhook`, `customer_portal_url`, `create_checkout`) com implementação Asaas e um webhook `POST /api/v1/billing/webhook/asaas` que grava o estado normalizado em `organizations` (`subscription_status`, `billing_provider`, `billing_customer_id`, `billing_subscription_id`, `billing_cycle`, `current_period_end`, `trial_ends_at`).
- **B)** Consultar o Asaas em tempo real a cada request (o padrão do `stripe.py` atual).
- **Recomendação: A.** B adiciona latência e dependência externa por request. Renomear as colunas `stripe_*` para `billing_*` numa migration. Incluir `trialing` em `SubscriptionStatus` e tornar a conversão em `deps.py:90` tolerante a valores desconhecidos (tratar como `inactive` e logar). Esforço: L (estimativa, incluindo idempotência do webhook e reconciliação).

### D3. Semântica de `trialing` e `inactive`
- **A)** `trialing` igual a `active` (escrita liberada) até `trial_ends_at`, e depois `inactive`.
- **B)** `trialing` com limites reduzidos (ex.: 1 contrato).
- Para `inactive`: manter a leitura (como o código faz hoje) ou bloquear a leitura (como o PRD diz).
- **Recomendação:** A, e manter a leitura em `inactive` até existir exportação. Bloquear a leitura sem exportação deixa o cliente sem acesso aos próprios dados. Atualizar o PRD para refletir isso.

### D4. Desacoplar o contrato mestre do Viabilidade
- **A)** Promover `contratos` a entidade core: mover as rotas para `app/api/routes/contratos.py`, deixar no core só os campos comuns (nome, cliente, status, arquivamento, código interno) e mover os campos de Viabilidade (`duracao_meses`, `prazo_pagamento_dias`, `regime_tributario`, `data_inicio`) para `viabilidade_contrato_config` (1:1). A versão inicial passa a ser criada ao "ativar Viabilidade no contrato".
- **B)** Manter a tabela e só tornar as colunas nullable, validando por módulo no backend.
- **Recomendação: A** se Gestão-sem-Viabilidade tiver chance real nos próximos 6 meses. Caso contrário, **B agora** (S–M) e A depois. Em qualquer caso, corrigir `contrato_modulo_vinculos.modulo` (`00003:142`) para aceitar `viabilidade` e renomear as funções `viabilidade_org_*` para nomes neutros.

### D5. Back-office do fundador
- **A)** Rotas `/api/v1/admin/*` no mesmo FastAPI, com allowlist de `user_id` staff (tabela `prumo_staff` ou variável de ambiente), e uma área `/admin` no Next.
- **B)** Supabase Studio + scripts SQL versionados.
- **C)** App separado.
- **Recomendação: A**, com escopo mínimo: criar org, convidar o 1º Owner (o convite precisa aceitar `role='owner'` quando emitido por staff), ajustar plano/extras/override, listar orgs com uso × limite. Gravar log de auditoria (D7). Esforço: L (estimativa).

### D6. Envio de convite
- **A)** `supabase.auth.admin.invite_user_by_email` com redirect para `/convite/[token]`.
- **B)** E-mail transacional próprio (Resend etc.) com o link do token.
- **Recomendação: B.** O aceite atual cria o usuário com senha (`routes_convites.py:112`), o que conflita com o fluxo do `invite_user_by_email`. Falta também a página de aceite no web.

### D7. Trilha de auditoria
- Tabela `audit_log(org_id, actor_user_id, action, entity, entity_id, payload jsonb, created_at)` gravada pelo backend, mais um trigger `updated_at` genérico. **Recomendação:** sim, antes do back-office, porque o fundador vai alterar dados de clientes.

### D8. Performance
- **Recomendação:** (1) carregar distribuições em lote com `.in_("linha_receita_id", ids)` em `mapping.py`; (2) uma RPC Postgres para a Home; (3) fixar `regions` da função Vercel na mesma região do Supabase. Cache de resultado só se ainda faltar desempenho depois disso.

---

## 4. O que NÃO precisa mudar

- **Motor de cálculo** (`services/motor.py`, `kpi_engine.py`, `cronograma_engine.py`, `whatif_engine.py`, `calendario.py`, `decimal_utils.py`): puro, sem I/O, bem testado (58 testes) e independente do modelo comercial.
- **Isolamento de tenant no backend**: escopo por `organization_id` em todos os `get_*_or_404` (`repository.py:88-99,246-257,481-493,526-538`) e escape de filtro PostgREST (`repository.py:28-31`, testado em `test_repository_escaping.py`).
- **RLS** habilitado em todas as tabelas, com funções `SECURITY DEFINER` e `search_path=''` (`00003:316-349`). Só precisa de rename (D4), não de redesenho.
- **Matriz de papéis** Owner/Executor/Viewer com gate no backend (`deps.py:111-128`). Os papéis do BP v2 (executor/viewer) são os mesmos.
- **Valores de capacidade**: Starter 1/2/5, Pro 2/3/12 e Master 3/7/25 já existem em `00003:29-32` (como `starter`, `pro_planejamento`, `master`).
- **Arquivamento por `arquivado_em`** e contagem de ativos (`repository.py:102-110`): o modelo serve, só falta corrigir o bug da resposta.
- **Versões, snapshots e what-if** (Tela 7) e o cascade corrigido em `00006`.
- **Backend do aceite de convite** (`routes_convites.py:99-165`), com rollback do usuário Auth em caso de falha e proteção contra account takeover (`:106-110`).
- **Pipeline de CI** (`.github/workflows/ci.yml`): pytest + lint + typecheck + build com gate único.

---

## 5. Perguntas que o código não responde

1. O banco de produção foi criado pela `00003` como está no repo? O erro de sintaxe em `00003:32-33` sugere aplicação manual ou editada. Quais valores existem hoje em `plan_capacities` e `organizations.plan_tier`?
2. Existem organizações reais com `pro_execucao`? Para qual plano do BP v2 elas migram?
3. Como as organizações de teste e piloto atuais foram criadas, e quem setou `subscription_status='active'`?
4. Em qual região estão o projeto Supabase e as funções da Vercel?
5. O preço (mensal/anual, desconto de 15%) é cadastrado no Asaas ou precisa existir no Prumo (ex.: tela de planos/checkout)?
6. "Módulos à escolha": o limite é de módulos **contratados pela org** ou de módulos **liberados por usuário** (o `active_modules` atual é por membro)? Um Viewer vê todos os módulos da org?
7. Os adicionais (executor/viewer/contrato extra) são contratados no Asaas (como item da assinatura) ou só ajustados pelo fundador no back-office?
8. No trial, há limite reduzido? Dá para converter o trial em plano sem perder dados? Quanto tempo dura?
9. O Owner conta no limite de executores? Hoje não conta (`routes_convites.py:49` só conta o papel convidado).
10. Um mesmo e-mail pode pertencer a mais de uma organização? Hoje não pode (`deps.py:64` `limit(1)`, e o aceite recusa e-mail existente em `routes_convites.py:120-126`).
11. Contrato `perdido_cancelado` não arquivado deve ocupar vaga de "contrato ativo"?
12. Quais formatos e escopo de exportação o BP v2 exige (PDF da Tela 6? Excel do DRE e do Fluxo?), e ela continua liberada em `inactive`?
13. Qual ferramenta de telemetria (PostHog, Vercel Analytics, eventos próprios) e qual é a definição de "ativação"?
