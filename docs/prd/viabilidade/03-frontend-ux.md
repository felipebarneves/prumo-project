# 03 — Interface, Fluxos & Componentes — Prumo Viabilidade

Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, `apps/web`. Dark First por padrão (`brand-identity.md`); tema claro (Tela 9) é uma adaptação de paleta simplificada, não um segundo design system com o mesmo rigor de contraste.

---

## 1. Inventário de Telas e Sub-rotas

| # | Tela | Rota sugerida (`apps/web`) |
|---|---|---|
| 1 | Cadastro e Consulta de Projetos | `/viabilidade/contratos` |
| 2 | Parâmetros de Input | `/viabilidade/contratos/[id]/parametros` |
| 3 | Cronograma Físico-Financeiro | `/viabilidade/contratos/[id]/cronograma` |
| 4 | DRE Detalhado + Resumo | `/viabilidade/contratos/[id]/dre` (sub-abas `detalhado`/`resumo`) |
| 5 | Fluxo de Caixa | `/viabilidade/contratos/[id]/fluxo-caixa` |
| 6 | Dashboard do Projeto | `/viabilidade/contratos/[id]/dashboard` |
| 7 | Cenários / What-If / Versões | `/viabilidade/contratos/[id]/versoes` |
| 8 | Home / Dashboard da Organização | `/viabilidade` (raiz do módulo) |
| 9 | Configurações | `/configuracoes` (compartilhada entre módulos) |
| 10 | Login / Esqueci Senha / Aceite de Convite | `/login`, `/esqueci-senha`, `/convite/[token]` |

## 2. Fluxo de Navegação do Usuário

1. **Login (Tela 10)** → **Home da Organização (Tela 8)**, agregando todos os projetos Viabilidade não-arquivados.
2. A partir da Home, o usuário abre um projeto → cai em **Cadastro/Consulta (Tela 1)** ou direto no **Dashboard (Tela 6)** do projeto mais recente.
3. Dentro de um projeto, um **Seletor de Versão global** no cabeçalho é compartilhado pelas Telas 2, 3, 4, 5 e 6 — trocar a versão muda o contexto simultaneamente em todas.
   - Telas 2 e 3 (únicas com edição): troca de versão com alterações pendentes exige confirmação **Salvar / Descartar / Cancelar**.
   - Telas 4, 5, 6 (100% leitura): trocam livremente, sem confirmação.
4. Tela 7 (Versões) é o hub de gestão de versões — criar, duplicar, comparar, simular what-if, excluir, salvar snapshots.
5. Tela 9 (Configurações) e Tela 10 (Auth) são transversais aos três módulos do Ecossistema Prumo, não exclusivas de Viabilidade.

## 3. Estados de UI por Tela

| Tela | Loading (Skeleton) | Erro | Empty State | Sucesso |
|---|---|---|---|---|
| 1 — Contratos | Skeleton de lista/tabela | Toast + retry | "Nenhum projeto cadastrado — crie o primeiro" com CTA | Lista/tabela com filtros aplicados |
| 2 — Parâmetros | Skeleton de formulário + tabelas | Inline por campo (validação Pydantic 422) | Tabela de Receita/Custo vazia com CTA "Adicionar linha" | Autosave/save explícito com indicador de "salvo" |
| 3 — Cronograma | Skeleton de grid | Aviso inline não-bloqueante (divergência de soma) | N/A (sempre há ao menos a distribuição linear) | Grid com células dentro/fora da janela visualmente distintas |
| 4 — DRE | Skeleton de tabela | Toast + retry | N/A (sempre há resultado, mesmo que zerado) | Tabela + nota de rodapé do IRPJ sempre visível |
| 5 — Fluxo de Caixa | Skeleton de tabela | Toast + retry | N/A | Tabela sequencial + indicadores de Capital de Giro |
| 6 — Dashboard | Skeleton de cards + gráficos | Toast + retry | Cards com `—` quando parâmetro correspondente vazio (nunca ocultos) | Grid de KPIs + 2 gráficos anuais |
| 7 — Versões | Skeleton de lista | Toast + retry | "Este projeto tem apenas 1 versão" (bloqueio de exclusão comunicado inline) | Lista + comparador lado a lado |
| 8 — Home Org. | Skeleton de cards | Toast + retry | "Nenhum projeto Viabilidade ainda" com CTA de criação | Cards agregados + lista de projetos |
| 9 — Configurações | Skeleton de seções | Inline por campo | N/A | Confirmação visual por seção salva |
| 10 — Auth | Spinner no botão | Mensagem genérica não-enumerável | N/A | Redirect pós-login/aceite |

Convenção única de "não calculado"/"não atingido": **sempre `—`**, nunca zero, erro ou mensagem ad hoc — aplicada consistentemente nas Telas 2, 4, 5 e 6.

## 4. Componentes Reutilizáveis (shadcn/ui + `brand-identity.md`)

- **Seletor de Versão** (componente global, especificado na Tela 2, reutilizado nas Telas 3–6): dropdown no cabeçalho, versão mais recente selecionada por padrão.
- **Grid de Distribuição Temporal** (Tela 3): células com 3 estados visuais — travada/cinza/`—` (fora da janela), branca/editável/`0` (dentro da janela, valor zero), branca/editável com valor (override).
- **Card de KPI** (Tela 6 e Home): sempre visível mesmo com valor `—`; nunca oculta condicionalmente (crítico para TIRM).
- **Diálogo de Confirmação Destrutiva**: usado em Reset de Distribuição, Exclusão de Versão, Exclusão Permanente de Projeto, Arquivamento em Cascata — sempre nomeia explicitamente o efeito da ação (ex.: lista de módulos afetados no arquivamento).
- **Comparador de Versões** (Tela 7): dois seletores lado a lado (Cenário A/B) + tabela comparativa (Receita Bruta, Impostos, Receita Líquida, Custos Totais, EBITDA, Margem EBITDA, Payback).
- **Dials de Simulação What-If** (Tela 7): três controles independentes (Ajuste de Receita %, Ajuste de Custo %, Ajuste de Volumetria — Receita %), recálculo ao vivo sem persistir.
- **Toggle Tema Claro/Escuro** (Tela 9): persistido por usuário (`profiles.theme_preference`), não por organização.

## 5. Regras de UX Não-Óbvias

- Viewer nunca vê ações de criar/editar/arquivar/vincular em nenhuma tela — ocultação visual é complementar, nunca substitui a validação de backend.
- Linha com `origem_line_id` (vínculo de Precificação) mostra indicador visual de "importada" e bloqueia campos de Total/Prazo/Valor Unitário na Tela 2, mas permanece editável na distribuição da Tela 3.
- Linha com override de distribuição (Tela 3) bloqueia Volumetria/Prazo na Tela 2 até Reset — UI deve comunicar isso via tooltip/estado disabled com explicação, não apenas desabilitar silenciosamente.
- Softblock de limite de plano (Contratos Ativos, Usuários): frontend desabilita a ação com tooltip explicativo e CTA de upgrade; backend sempre revalida no submit.
