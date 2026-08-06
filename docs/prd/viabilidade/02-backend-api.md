# 02 — Contratos de API & Webhooks — Prumo Viabilidade

Backend: Python 3.11+, FastAPI, Pydantic, `apps/api`. Toda regra de negócio, cálculo financeiro e gatekeeping por plano/assinatura é validada aqui — nunca confiar no frontend como fonte de verdade.

Todos os endpoints exigem sessão Supabase Auth válida (Bearer JWT), exceto os de aceite de convite e recuperação de senha (ver `04-auth-integrations.md`). Todas as respostas de erro seguem o padrão HTTP: `400` (validação/regra de negócio), `401` (não autenticado), `403` (autenticado, sem permissão), `422` (schema Pydantic inválido), `500` (erro inesperado).

---

## 1. Contratos / Projetos (Tela 1)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/contratos` | Lista contratos da organização; filtros `status_ciclo_vida`, `modulos_vinculados`, `arquivado` (default `false`), busca livre |
| POST | `/api/v1/contratos` | Cria contrato + primeira versão. Valida limite de Contratos Ativos do tier (softblock 400 com payload de upsell) |
| GET | `/api/v1/contratos/{id}` | Detalhe do contrato |
| PATCH | `/api/v1/contratos/{id}` | Atualiza campos editáveis — rejeita alteração de `regime_tributario` (400) |
| POST | `/api/v1/contratos/{id}/arquivar` | Arquiva em cascata para todos os módulos vinculados (retorna lista de módulos afetados para confirmação) |
| POST | `/api/v1/contratos/{id}/desarquivar` | Revalida limite de Contratos Ativos antes de desarquivar |
| DELETE | `/api/v1/contratos/{id}` | Exclusão permanente — restrita a Owner (403 para Executor/Viewer) |
| POST | `/api/v1/contratos/{id}/vincular-modulo` | Cria vínculo com módulo adjacente + dispara importação por cópia das linhas (`origem_line_id`) |
| POST | `/api/v1/contratos/{id}/desvincular-modulo` | Preenche `desvinculado_em` (soft) |

**Request (`POST /contratos`):** `nome_projeto`, `cliente`, `data_inicio`, `duracao_meses`, `nome_contrato`, `prazo_pagamento_dias` (enum 30/60/90), `nome_versao`, `regime_tributario`, `codigo_interno?`, `segmento_cliente_final?`.

## 2. Parâmetros de Input (Tela 2)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/versoes/{versao_id}/parametros` | Parâmetros gerais da versão |
| PUT | `/api/v1/versoes/{versao_id}/parametros` | Upsert de `aliquota_tributaria_efetiva`, `tma?`, `taxa_reinvestimento?`, `taxa_custo_captacao?` |
| GET | `/api/v1/versoes/{versao_id}/linhas-receita` | Lista linhas de receita da versão |
| POST | `/api/v1/versoes/{versao_id}/linhas-receita` | Cria linha; total sempre calculado no response, nunca aceito como input |
| PATCH | `/api/v1/linhas-receita/{id}` | Bloqueia edição de volumetria/prazo/valor unitário se `origem_line_id` presente ou se houver override de distribuição (400 com motivo) |
| DELETE | `/api/v1/linhas-receita/{id}` | — |
| GET/POST/PATCH/DELETE | `/api/v1/versoes/{versao_id}/linhas-custo[...]` | Espelha o conjunto de Receita, sem alíquota |
| GET/POST/PATCH/DELETE | `/api/v1/versoes/{versao_id}/despesas-nao-operacionais[...]` | CRUD de despesas; `tipo` (`despesa`\|`recuperacao`), `percentual`, `linha_receita_referencia_id?` |

## 3. Cronograma Físico-Financeiro (Tela 3)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/linhas-receita/{id}/distribuicao` | Retorna distribuição efetiva (override existente ou linear calculada em tempo de leitura) |
| PUT | `/api/v1/linhas-receita/{id}/distribuicao` | Grava overrides célula a célula; valida soma vs. total da linha no backend, retorna aviso não-bloqueante em caso de divergência |
| POST | `/api/v1/linhas-receita/{id}/reset-distribuicao` | Apaga overrides, libera Total/Prazo na Tela 2 (ação destrutiva, exige `confirm: true` no body) |
| GET/PUT/POST | `/api/v1/linhas-custo/{id}/distribuicao[...]` | Espelha o conjunto de Receita |
| POST | `/api/v1/versoes/{versao_id}/reset-distribuicao-lote` | Reset em lote de toda a aba (Receita ou Custo) |

## 4. DRE (Tela 4)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/versoes/{versao_id}/dre?granularidade=mensal` | DRE Detalhado — granularidade mensal fixa, EBIT Acumulado incluso |
| GET | `/api/v1/versoes/{versao_id}/dre/resumo?granularidade=trimestral\|semestral\|anual` | Resumo DRE agregado por período |

Ambos são 100% derivados (sem body de escrita) — puro resultado do motor de cálculo (`01b-business-rules-engine.md`).

## 5. Fluxo de Caixa (Tela 5)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/versoes/{versao_id}/fluxo-caixa` | Série completa: Entrada de Caixa, Fluxo Líquido Operacional/Geral, Fluxo Acumulado bruto, Custo Financeiro, Saldo de Caixa Final |
| GET | `/api/v1/versoes/{versao_id}/kpis` | VPL, TIR, TIRM, Payback, Breakeven, Capital de Giro — cada campo `null`-safe conforme convenção `—` |

## 6. Dashboard do Projeto (Tela 6)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/contratos/{id}/dashboard?versao_id=` | Agrega os 10 cards de KPI + séries anuais de DRE e Fluxo de Caixa para gráficos |

## 7. Cenários / What-If / Versões (Tela 7)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/contratos/{id}/versoes` | Histórico: nome, criado por, data, status de vínculo com Precificação |
| POST | `/api/v1/contratos/{id}/versoes` | Cria versão (cópia completa de Telas 2-5) ou duplica de `origem_versao_id` |
| PATCH | `/api/v1/versoes/{id}` | Renomeia |
| DELETE | `/api/v1/versoes/{id}` | Bloqueia se for a última versão do contrato (400); se excluída era a versão ativa, resposta indica a versão mais recente restante |
| POST | `/api/v1/versoes/comparar` | Body: `versao_a_id`, `versao_b_id` → tabela lado a lado (não persiste) |
| POST | `/api/v1/versoes/whatif` | Body: `versao_base_id`, `ajuste_receita_pct?`, `ajuste_custo_pct?`, `ajuste_volumetria_receita_pct?` → recálculo ao vivo via motor completo, não persiste |
| POST | `/api/v1/versoes/snapshots` | Salva snapshot (`comparacao`\|`whatif`) — grava `resultado` congelado em `versao_snapshots` |
| GET | `/api/v1/contratos/{id}/snapshots` | Lista snapshots salvos (read-only, nunca recalculados) |
| DELETE | `/api/v1/versoes/snapshots/{id}` | — |

## 8. Home da Organização (Tela 8)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/organizacoes/{id}/home` | Agrega Receita Bruta Total, EBITDA Total, Margem EBITDA (`EBITDA Total ÷ Receita Bruta Total`, nunca média simples), Contratos Ativos ("X de Y" do tier) — sempre versão mais recente por projeto, projetos arquivados excluídos por padrão |

## 9. Configurações (Tela 9)

| Método | Rota | Descrição |
|---|---|---|
| GET/PATCH | `/api/v1/organizacoes/{id}` | Perfil da organização (Nome, CNPJ) — editável apenas Owner |
| GET/PATCH | `/api/v1/perfil` | Perfil do usuário (Nome); `PATCH /perfil/tema` para `theme_preference` |
| POST | `/api/v1/perfil/trocar-email` | Envia link de confirmação ao novo e-mail; só efetiva no clique |
| POST | `/api/v1/perfil/trocar-senha` | Exige senha atual (reautenticação) |
| GET | `/api/v1/organizacoes/{id}/membros` | Owner-only |
| POST | `/api/v1/organizacoes/{id}/convites` | Owner-only — cria convite `pendente`, não consome vaga até aceite |
| PATCH/DELETE | `/api/v1/convites/{id}` | Owner-only — trocar papel / remover membro |
| GET | `/api/v1/organizacoes/{id}/plano` | Owner-only, view-only: tier, uso de capacidade, `subscription_status` |

## 10. Billing / Checkout & Webhooks Stripe

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/billing/create-checkout-session` | Cria sessão de checkout Stripe para upgrade/assinatura inicial |
| POST | `/api/v1/billing/portal` | Gera link do portal de gerenciamento de assinatura Stripe (usado no botão "Gerenciar Assinatura" da Tela 9) |
| POST | `/api/v1/stripe/webhook` | Trata eventos: `customer.subscription.updated` (sincroniza `plan_tier`/`subscription_status`), `customer.subscription.deleted`, `invoice.payment_failed` (→ `past_due`), `invoice.payment_succeeded` (→ `active`) |

## 11. Autenticação e Convites (Tela 10)

Ver detalhamento completo de fluxo em `04-auth-integrations.md`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/auth/login` | Proxy/validação sobre Supabase Auth; erro genérico não-enumerável |
| POST | `/api/v1/auth/esqueci-senha` | Idem, não confirma/nega existência do e-mail |
| GET | `/api/v1/convites/{token}` | Retorna e-mail e papel pré-preenchidos (não-editáveis) para a tela de aceite |
| POST | `/api/v1/convites/{token}/aceitar` | Cria conta, transiciona convite `pendente → aceito` — gatilho exato que passa a contar no limite de Usuários |

## 12. Validações Transversais de Toda a API

- Toda rota de escrita revalida: papel do usuário (RLS + checagem explícita de negócio), `subscription_status` (bloqueia `past_due`/`inactive` conforme matriz de `04-auth-integrations.md`), limite de tier quando aplicável.
- Nenhum endpoint aceita valor total/calculado como input direto onde a regra de negócio define o campo como derivado (ex.: total de linha, valor de despesa não operacional, distribuição linear).
- Ações destrutivas (reset de distribuição, exclusão de versão, exclusão permanente de projeto, arquivamento em cascata) exigem campo explícito de confirmação no body da requisição.
