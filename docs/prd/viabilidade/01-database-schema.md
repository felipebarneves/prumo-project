# 01 — Modelagem do Banco & RLS — Prumo Viabilidade

**Status:** Implementado em `supabase/migrations/00003_viabilidade_schema.sql` (depende de `00001_initial_schema.sql` e `00002_stripe_schema.sql`).

---

## 1. Diagrama Relacional (visão lógica)

```
organizations (00001) ──< contratos ──< versoes ──< parametros_versao (1:1)
     │                       │              ├──< linhas_receita ──< distribuicao_receita
     │                       │              ├──< linhas_custo ──< distribuicao_custo
     │                       │              └──< despesas_nao_operacionais
     │                       ├──< contrato_modulo_vinculos
     │                       └──< versao_snapshots (>─ versoes A/B)
     ├──< organization_invites
     └──< profiles (00001, via organization_members)
```

`versao_id` é chave transversal de todo o schema das Telas 2 a 6 — cada versão mantém um conjunto de dados completo e isolado, sem compartilhamento entre versões do mesmo projeto.

## 2. Tabelas, Colunas, Tipos e FKs

### 2.1. Estrutura Comercial

**`plan_tier`** (ENUM): `starter | pro_planejamento | pro_execucao | master`

**`plan_capacities`** — referência estática, seed fixo, não editável via API:

| Coluna | Tipo | Regra |
|---|---|---|
| `tier` | `plan_tier` PK | — |
| `max_executors` | INTEGER | Starter 1 / Pro Planej. 2 / Pro Exec. 2 / Master 3 |
| `max_viewers` | INTEGER | Starter 2 / Pro Planej. 3 / Pro Exec. 4 / Master 7 |
| `max_active_contracts` | INTEGER | Starter 5 / Pro Planej. 12 / Pro Exec. 15 / Master 25 |

**`organizations.plan_tier`** (ALTER, 00001): `plan_tier NOT NULL DEFAULT 'starter'`.

**Modelagem de Faturamento:** `stripe_customer_id`, `stripe_subscription_id` e `subscription_status` (`active | past_due | inactive`) já residem em `organizations` desde `00002_stripe_schema.sql`. Gatekeeping de leitura/escrita por `subscription_status` é responsabilidade do FastAPI (camada de autorização), não de RLS — RLS garante isolamento de tenant; o backend garante a semântica comercial de bloqueio de escrita.

### 2.2. Convites de Usuário

**`invite_status`** (ENUM): `pendente | aceito | expirado | cancelado`

**`organization_invites`**

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `organization_id` | UUID FK → `organizations.id` ON DELETE CASCADE | — |
| `email` | TEXT | — |
| `role` | `organization_role` | CHECK IN (`executor`, `viewer`) |
| `status` | `invite_status` | default `pendente` |
| `token` | UUID | default `gen_random_uuid()`, índice único |
| `invited_by` | UUID FK → `profiles.id` | — |
| `accepted_by` | UUID FK → `profiles.id` | nullable |
| `expires_at` | TIMESTAMPTZ | default `NOW() + 7 days` |

Constraint: `UNIQUE (organization_id, email, status)`. Convite só conta no limite de Usuários do plano após `status = aceito`.

**`theme_preference`** (ENUM): `claro | escuro` — coluna em `profiles`, default `escuro` (Dark First).

### 2.3. Contrato Mestre (Tela 1)

**`regime_tributario`** (ENUM): `lucro_presumido | lucro_real`
**`status_ciclo_vida`** (ENUM): `em_prospeccao | contrato_assinado | em_execucao | encerrado | cancelado`
**`modulo_prumo`** (ENUM): `precificacao | viabilidade | gestao`

**`contratos`** — entidade compartilhada entre os 3 módulos; este schema é o dono de registro (source of truth) do `contrato_id` mestre.

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | UUID PK | — |
| `organization_id` | UUID FK → `organizations.id` CASCADE | — |
| `nome_projeto`, `cliente`, `nome_contrato` | TEXT NOT NULL | — |
| `data_inicio` | DATE NOT NULL | — |
| `duracao_meses` | INTEGER | CHECK ≥ 1 |
| `prazo_pagamento_dias` | INTEGER | CHECK IN (30, 60, 90) — fechado, sem intermediários |
| `regime_tributario` | `regime_tributario` NOT NULL | **Imutável após criação** — enforce no FastAPI, nunca editável em update |
| `status_ciclo_vida` | `status_ciclo_vida` | default `em_prospeccao` |
| `moeda` | TEXT | CHECK = `'BRL'` (fixo, sem multi-moeda) |
| `codigo_interno`, `segmento_cliente_final` | TEXT | opcionais |
| `arquivado_em` | TIMESTAMPTZ | NULL = ativo (conta no limite do tier); preenchido = arquivado (fora da contagem, leitura preservada); distinto de exclusão permanente (DELETE) |
| `created_by` | UUID FK → `profiles.id` | — |

Índices: `(organization_id)`, `(organization_id, arquivado_em)`.

**`contrato_modulo_vinculos`** — vínculo entre módulos adjacentes (Precificação↔Viabilidade↔Gestão); guarda apenas a referência, a importação por cópia ocorre em `linhas_receita`/`linhas_custo` via `origem_line_id`.

| Coluna | Tipo | Regra |
|---|---|---|
| `contrato_id` | UUID FK → `contratos.id` CASCADE | — |
| `modulo` | `modulo_prumo` | CHECK IN (`precificacao`, `gestao`) |
| `contrato_origem_id` | UUID | `contrato_id` mestre no módulo adjacente (FK cruzada fora do escopo deste schema) |
| `vinculado_em`, `desvinculado_em` | TIMESTAMPTZ | desvincular preenche `desvinculado_em` (não exclui, para auditoria) |

Constraint: `UNIQUE (contrato_id, modulo)`.

### 2.4. Versões (Tela 7)

**`versoes`**

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | UUID PK | — |
| `contrato_id` | UUID FK → `contratos.id` CASCADE | — |
| `nome_versao` | TEXT NOT NULL | — |
| `origem_versao_id` | UUID FK → `versoes.id` | preenchido se criada por "Duplicar" |
| `created_by` | UUID FK → `profiles.id` | — |

Sem versão principal/ativa marcada — a mais recente por `created_at` abre por padrão. Exclusão bloqueada no FastAPI se for a última versão do contrato.

### 2.5. Parâmetros Gerais da Versão (Tela 2)

**`parametros_versao`** (1:1 com `versoes`, PK = `versao_id`)

| Coluna | Tipo | Regra semântica de nulo |
|---|---|---|
| `aliquota_tributaria_efetiva` | NUMERIC(7,4) NOT NULL | CHECK ≥ 0 |
| `tma` | NUMERIC(7,4) NULL | NULL = "não calcular" VPL (exibe `—`) — nunca 0 como sentinela |
| `taxa_reinvestimento` | NUMERIC(7,4) NULL | NULL = "não calcular" TIRM (exibe `—`) |
| `taxa_custo_captacao` | NUMERIC(7,4) NULL | NULL = Custo Financeiro calculado como **zero** (resultado válido) — regra oposta às duas acima |

### 2.6. Linhas de Receita/Custo e Distribuição (Telas 2 e 3)

**`linhas_receita`**

| Coluna | Tipo | Regra |
|---|---|---|
| `versao_id` | UUID FK → `versoes.id` CASCADE | — |
| `descricao`, `unidade_medida` | TEXT NOT NULL | — |
| `mes_inicio`, `prazo_meses` | INTEGER NULL | CHECK ≥ 1 se preenchido; herdam Data de Início/Duração do projeto se vazios |
| `volumetria` | NUMERIC(18,4) | CHECK ≥ 0 |
| `valor_unitario` | NUMERIC(18,4) | CHECK ≥ 0, fixo durante a janela |
| `aliquota_especifica` | NUMERIC(7,4) NULL | herda a geral se vazia |
| `origem_line_id` | UUID NULL | rastreio de importação de Precificação — **não é FK de leitura ao vivo**; presente = bloqueia edição de volumetria/prazo/valor unitário |

Total da linha é sempre **calculado** (`volumetria × valor_unitario`) — nunca persistido como campo próprio.

**`linhas_custo`**: mesma estrutura, campo `custo_unitario` no lugar de `valor_unitario`, sem `aliquota_especifica`.

**`distribuicao_receita` / `distribuicao_custo`** — a distribuição linear em si **não é persistida**; é calculada em tempo de leitura quando não houver overrides. Apenas overrides manuais geram registro.

| Coluna | Tipo | Regra |
|---|---|---|
| `linha_receita_id` / `linha_custo_id` | UUID FK CASCADE | — |
| `mes` | INTEGER | CHECK ≥ 1 |
| `volumetria` | NUMERIC(18,4) | CHECK ≥ 0 |

Constraint: `UNIQUE (linha_id, mes)`. Existência de qualquer linha aqui para uma `linha_receita_id` = "possui override manual" — bloqueia edição de volumetria/prazo na Tela 2 até Reset.

### 2.7. Despesas Não Operacionais (Tela 2)

**`despesa_tipo`** (ENUM): `despesa | recuperacao`

**`despesas_nao_operacionais`**

| Coluna | Tipo | Regra |
|---|---|---|
| `versao_id` | UUID FK CASCADE | — |
| `tipo` | `despesa_tipo` | `despesa` reduz resultado, `recuperacao` aumenta (usuário sempre digita valor positivo, sinal aplicado pelo sistema) |
| `percentual` | NUMERIC(7,4) | CHECK ≥ 0 |
| `linha_receita_referencia_id` | UUID FK → `linhas_receita.id` ON DELETE SET NULL | opcional — vazio aplica sobre Receita Bruta Total |

Sem schema de distribuição temporal próprio — valor mensal sempre calculado em tempo de leitura. **Custo Financeiro não é uma linha desta tabela** — é projeção calculada de `parametros_versao.taxa_custo_captacao`.

### 2.8. Cenários / Snapshots Salvos (Tela 7)

**`snapshot_tipo`** (ENUM): `comparacao | whatif`

**`versao_snapshots`**

| Coluna | Tipo | Regra |
|---|---|---|
| `contrato_id` | UUID FK CASCADE | — |
| `tipo` | `snapshot_tipo` | — |
| `versao_a_id` | UUID FK → `versoes.id` NOT NULL | — |
| `versao_b_id` | UUID FK → `versoes.id` NULL | NULL para `whatif` (uma única versão-base) |
| `ajustes_whatif` | JSONB NULL | `{ajuste_receita_pct, ajuste_custo_pct, ajuste_volumetria_receita_pct}` — apenas se `tipo = whatif` |
| `resultado` | JSONB NOT NULL | payload congelado no momento do "Salvar" — **nunca recalculado** |

## 3. Índices de Performance

- `contratos(organization_id)`, `contratos(organization_id, arquivado_em)`
- `contrato_modulo_vinculos(contrato_id)`
- `versoes(contrato_id)`
- `linhas_receita(versao_id)`, `linhas_custo(versao_id)`
- `distribuicao_receita(linha_receita_id)`, `distribuicao_custo(linha_custo_id)`
- `despesas_nao_operacionais(versao_id)`
- `versao_snapshots(contrato_id)`
- `organization_invites`: índice único em `token`

## 4. Row Level Security (RLS)

Todas as tabelas do módulo têm RLS habilitado. Três funções auxiliares `SECURITY DEFINER` (com `search_path = ''` fixo, para evitar recursão de RLS e sequestro de search_path) resolvem o papel do usuário sem duplicar lógica em cada política:

- `viabilidade_org_role(organization_id) → organization_role` — papel do usuário autenticado na organização, ou NULL se não for membro.
- `viabilidade_org_id_for_contrato(contrato_id) → organization_id`
- `viabilidade_org_id_for_versao(versao_id) → organization_id`

**Padrão de política por tabela:**

| Tabela | SELECT | INSERT/UPDATE | DELETE |
|---|---|---|---|
| `plan_capacities` | qualquer autenticado | — (seed apenas) | — |
| `organization_invites` | Owner da organização | Owner | Owner (via UPDATE de status) |
| `contratos` | qualquer membro | Owner/Executor | apenas Owner |
| `contrato_modulo_vinculos` | qualquer membro | Owner/Executor | — (soft via `desvinculado_em`) |
| `versoes` | qualquer membro | Owner/Executor | Owner/Executor |
| `parametros_versao` | qualquer membro | Owner/Executor | — |
| `linhas_receita` / `linhas_custo` | qualquer membro | Owner/Executor | Owner/Executor |
| `distribuicao_receita` / `distribuicao_custo` | qualquer membro (via subselect à linha pai) | Owner/Executor | Owner/Executor |
| `despesas_nao_operacionais` | qualquer membro | Owner/Executor | Owner/Executor |
| `versao_snapshots` | qualquer membro | Owner/Executor (INSERT) | Owner/Executor |

Isolamento multitenant: toda política de leitura exige `viabilidade_org_role(...) IS NOT NULL` (associação ativa à organização via `organization_members`, herdada de `00001`); toda política de escrita restringe a `owner`/`executor` — Viewer nunca aparece como papel autorizado em INSERT/UPDATE/DELETE em nenhuma tabela do módulo.

## 5. Notas de Fronteira (deliberadamente fora do banco)

- Contagem de limite de Contratos Ativos e de Usuários (`plan_capacities`) é validada no FastAPI antes do INSERT/UPDATE relevante — sem trigger de banco, pois a mensagem de softblock precisa retornar contexto de upsell que pertence à camada de API.
- Validação de soma (distribuição vs. total da linha, Tela 3) roda no FastAPI na gravação — não é constraint de banco, pois o desvio é um aviso não-bloqueante, não um erro.
- `subscription_status` (`past_due`/`inactive`) e downgrade de tier bloqueiam **escrita** por regra de produto, mas RLS permite escrita a Owner/Executor independentemente do status da assinatura — esse gate adicional depende de estado do Stripe, não de tenant/papel, e é aplicado no FastAPI.
