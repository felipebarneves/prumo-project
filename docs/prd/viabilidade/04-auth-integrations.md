# 04 — Autenticação, RBAC & Gatekeeping — Prumo Viabilidade

---

## 1. Modelo de Autenticação

- **Provedor:** Supabase Auth, e-mail + senha apenas — sem OAuth/login social no MVP.
- **Sem self-signup:** toda organização nasce de provisionamento externo ao fluxo de UI. Acesso individual só via convite do Owner ou provisionamento do primeiro Owner.
- Mensagens de erro (login e recuperação de senha) seguem princípio de **não-enumeração** — nunca confirmam/negam explicitamente a existência de um e-mail na base (ex.: "E-mail ou senha incorretos", sem indicar qual campo está errado).
- Tokens (redefinição de senha, convite) expiram após uso único ou tempo determinado (padrão Supabase Auth para senha; 7 dias para convite, `organization_invites.expires_at`); expirado/usado exibe erro claro com orientação.
- Trocas de e-mail e senha exigem confirmação/reautenticação antes de efetivar: e-mail só se efetiva após clique no link enviado ao **novo** endereço; senha exige reautenticação com a senha atual.

## 2. Aceite de Convite

- Convite gerado pelo Owner com e-mail + papel pré-definidos.
- Ao acessar o link de aceite, o usuário vê e-mail e papel **pré-preenchidos e não-editáveis**, preenchendo apenas Nome de Usuário e Senha.
- Ao concluir o cadastro, o convite transiciona `pendente → aceito` — **este é o gatilho exato** que passa a contar no limite de Usuários do plano (não a criação do convite).

## 3. Matriz de Permissões (RBAC)

| Papel | Escopo |
|---|---|
| **Owner** (único por organização) | Faturamento, convite/exclusão de membros, exclusão permanente de projetos, todas as permissões de Executor |
| **Executor** (Analyst/Creator) | Cria projetos, ajusta premissas, edita tabelas, executa simulações, salva versões, arquiva contratos |
| **Viewer** (Executive) | Leitura, dashboards, relatórios, comparativos, exportação — sem escrita |

**Regras adicionais:**
- Owner é sempre adicional, não conta no limite de usuários do tier.
- Papéis (Executor/Viewer) são fixos por tier na v1 — sem redistribuição livre entre eles.
- Exclusão permanente de projeto é exclusiva de Owner — Executor não tem essa permissão mesmo podendo arquivar.
- Gestão de Usuários e Plano Atual (Tela 9) são Owner-only — acesso deve ser bloqueado em nível de rota/API, nunca apenas ocultação visual (validar via chamada direta à API, contornando o frontend).

**Requisito não-funcional transversal:** toda validação de permissão e de limite de plano deve ser reforçada no backend — nunca depender exclusivamente do estado do frontend. RLS no Supabase reflete essa matriz (ver `01-database-schema.md`, seção 4) para isolamento de tenant e papel; o FastAPI aplica a semântica de negócio completa (incluindo gates que dependem de `subscription_status`, fora do escopo do RLS).

## 4. Gatekeeping por Assinatura (Paywall Interno — Stripe)

| `subscription_status` | Comportamento |
|---|---|
| `active` | Libera conforme tier contratado (`plan_tier`) |
| `past_due` | Mantém leitura; **bloqueia toda escrita** |
| `inactive` | Bloqueia tudo, **exceto exportação** |

- **Downgrade de tier:** bloqueia escrita (criar, editar, simular) apenas nos módulos/dados fora do novo tier; leitura e exportação de todos os dados históricos permanecem **sempre** liberadas, em qualquer tier.
- Este gate é aplicado exclusivamente no FastAPI (camada de autorização de negócio) — depende de estado do Stripe sincronizado via webhook, não de tenant/papel, portanto não é modelado como política RLS.

## 5. Capacidade por Tier (Contexto de Gatekeeping)

| | Starter | Pro Planejamento | Pro Execução | Master |
|---|---|---|---|---|
| Executor | 1 | 2 | 2 | 3 |
| Viewer | 2 | 3 | 4 | 7 |
| Total usuários | 3 | 5 | 6 | 10 |
| Contratos/Projetos Ativos | 5 | 12 | 15 | 25 |

- Limite de usuários e de contratos ativos são contadores **independentes**, ambos teto duro (sem cobrança incremental na v1).
- Softblock: frontend desabilita ação com tooltip explicativo; backend sempre revalida no submit (criar projeto, desarquivar, convidar usuário).
- Contador de Contratos/Projetos Ativos incide sobre `contrato_id` mestre — um projeto vinculado aos 3 módulos consome apenas 1 unidade.

## 6. Combinações Comerciais Válidas de Módulo

| Plano | Módulos incluídos |
|---|---|
| Starter | Viabilidade **ou** Precificação (escolha única) |
| Pro Planejamento | Viabilidade + Precificação |
| Pro Execução | Viabilidade + Gestão |
| Master | Viabilidade + Precificação + Gestão |

Gestão nunca é vendido isoladamente. Inválidas: Gestão sozinho; Precificação+Gestão sem Viabilidade.
