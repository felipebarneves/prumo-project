# 00 — Visão Geral & Escopo — Prumo Viabilidade

**Autor:** Agente Nexus (PM)
**Módulo:** Prumo Viabilidade (1 de 3 módulos do Ecossistema Prumo)
**Status:** Oficial — pronto para handoff ao Atlas (Arquiteto)
**Fontes:** `docs/handoff/viabilidade/` (12 documentos da Fase 1 — Análise Crítica)

---

## 1. O Problema da PME

PMEs prestadoras de serviço (construção, facilities, outsourcing operacional) decidem se um contrato "vale a pena" hoje em planilhas Excel frágeis, sem padronização entre projetos, sem histórico de versões auditável e sem visão de fluxo de caixa separada do resultado contábil. Isso gera três dores recorrentes:

1. Decisões de viabilidade tomadas sobre premissas desatualizadas ou não rastreáveis.
2. Incapacidade de comparar cenários (versões) de forma confiável.
3. Confusão entre "lucro no papel" (DRE) e "dinheiro em caixa" (Fluxo de Caixa) — justamente onde projetos aparentemente lucrativos quebram por falta de capital de giro.

## 2. Proposta de Valor / Objetivo do Módulo

O Prumo Viabilidade substitui a planilha de análise de viabilidade de contratos por um produto SaaS multitenant que: cadastra o contrato, parametriza premissas de receita/custo, distribui essas premissas no tempo, calcula automaticamente DRE (competência) e Fluxo de Caixa (caixa), consolida KPIs de decisão (VPL, TIR, TIRM, Payback, Breakeven, Capital de Giro) e permite versionamento/comparação de cenários — tudo com o motor de cálculo rodando 100% no backend, nunca dependente de lógica de frontend.

## 3. Posicionamento no Ecossistema Prumo

O Viabilidade é o módulo intermediário de uma cadeia unidirecional de dados: **Precificação → Viabilidade → Gestão**. Cada seta é uma importação por cópia (snapshot), nunca uma leitura ao vivo — o módulo a jusante nunca escreve de volta no módulo a montante. Os três módulos compartilham uma entidade `contrato_id` mestre (1:1 por par adjacente na cadeia), mas Viabilidade pode ser contratado e operado de forma standalone. Gestão nunca é vendido nem opera sem Viabilidade contratado.

## 4. Personas / Usuários-Alvo e Jobs-to-be-Done

| Persona | Papel no sistema | Job-to-be-Done principal |
|---|---|---|
| Sócio/Diretor da PME | Owner | Decidir se um contrato vale a pena, comparar cenários, controlar faturamento e equipe |
| Analista financeiro/Orçamentista | Executor (Analyst/Creator) | Parametrizar premissas, distribuir cronogramas, rodar simulações e versões |
| Executivo/Cliente interno leitor | Viewer (Executive) | Consultar dashboards, exportar relatórios, sem poder de edição |

## 5. Métricas de Sucesso do Módulo

- Tempo para primeira análise de viabilidade completa (cadastro → DRE → Fluxo de Caixa) abaixo do tempo equivalente em planilha.
- Taxa de adoção de versionamento (nº médio de versões por projeto) como proxy de confiança no comparativo de cenários.
- Zero incidentes de vazamento de dado entre tenants (RLS) e zero cálculo financeiro executado no frontend.
- Taxa de conversão Starter → Pro/Master via uso do limite de Contratos Ativos/Usuários.

## 6. Escopo do MVP (10 Telas)

| # | Tela | Função |
|---|---|---|
| 1 | Cadastro e Consulta de Projetos/Contratos | Porta de entrada — cadastro do `contrato_id` mestre, vínculo entre módulos, arquivamento |
| 2 | Parâmetros de Input | Tela mais estrutural — parâmetros gerais, linhas de Receita/Custo/Despesas Não Operacionais |
| 3 | Cronograma Físico-Financeiro | Distribuição temporal da Volumetria (linear ou manual) |
| 4 | DRE Detalhado + Resumo DRE | Resultado em regime de competência pura |
| 5 | Fluxo de Caixa | Conversão de competência para caixa, Capital de Giro, base de VPL/TIR/TIRM |
| 6 | Dashboard do Projeto | Resumo executivo de um projeto — KPIs e gráficos anuais |
| 7 | Cenários / What-If / Versões | Comparação de versões, simulação paramétrica, histórico, snapshots salvos |
| 8 | Home / Dashboard da Organização | Agregação entre todos os projetos Viabilidade da organização |
| 9 | Configurações | Perfil, tema, gestão de usuários, plano contratado |
| 10 | Login / Esqueci Senha / Aceite de Convite | Autenticação via Supabase Auth |

## 7. Fora do Escopo do MVP (Backlog v2)

- Contratação avulsa de usuários/contratos além do limite do tier (add-on de assento/metering).
- Flexibilização de pool de papéis (mistura livre Executor/Viewer além do fixo por tier).
- Reajuste contratual (IPCA/IGP-M, dissídio, materiais, frota) — permanece no Prumo Precificação.
- Descasamento de pagamento a fornecedores (deslocamento de Custo no Fluxo de Caixa, hoje só Receita desloca).
- Modelo iterativo de Custo Financeiro (hoje passada única).
- Percentuais intermediários de Prazo de Pagamento (45/75 dias) — hoje restrito a 30/60/90.
- Toggle "Considerar Custo Financeiro" nos KPIs (avaliado e descartado — resolvido pelo input na origem).
- Vínculo automático entre Volumetria de Receita e de Custo na simulação what-if.
- Transferência de titularidade de Owner.
- Login social e self-signup (inclui modelo de governança de criação de conta, ainda não desenhado).
- Agregação entre módulos (Viabilidade + Precificação + Gestão) e gráficos com eixo temporal na Home da organização.
- Mensagens diferenciadas para KPIs "não atingidos" (hoje, convenção única `—`).

## 8. Pontos em Aberto — Não Bloqueiam o MVP, Mas Devem Ser Rastreados

- Separação formal, na engine de cálculo, entre taxa de desconto do VPL (TMA) e custo de capital de giro/overdraft (Taxa de Custo de Captação) — hoje resolvida operacionalmente (dois inputs distintos), sem mecânica de interação formalmente desenhada além do especificado em `01b-business-rules-engine.md`.
- Definição final do rótulo/conceito de "Capital de Giro" para efeitos de comunicação com o cliente — hoje definido tecnicamente como pico de caixa negativo acumulado, distinto da definição contábil clássica (AR+Estoque-AP).
- Fluxo de reimportação subsequente com diff (valor antigo vs. novo) entre módulos vinculados — fora do escopo das 10 telas atuais, a ser especificado em iteração futura.

---

*Ver também: `01-database-schema.md`, `01b-business-rules-engine.md`, `02-backend-api.md`, `03-frontend-ux.md`, `04-auth-integrations.md`, `05-deploy-ops.md`.*
