# Resumo — Prumo Viabilidade
### Para construção conjunta das telas (novo chat)

> Contexto: este resumo consolida **todas as decisões já fechadas** na análise crítica (Fase 1) do módulo Prumo Viabilidade — regras fiscais, modelo de dados, integração entre módulos, papéis de usuário e estrutura comercial — para servir de base à construção das telas do produto, tela por tela, na ordem já acordada. Não é o PRD oficial e não substitui a Minuta de Requisitos comercial (documento separado, já fechado).

---

## 1. Ordem de construção das telas (acordada)

Sequência da mais estrutural para a mais derivada — cada tela depende de decisões tomadas na anterior:

1. **Cadastro e Consulta de Projetos/Contratos** — porta de entrada; toca vínculo entre módulos, arquivamento, limite de plano.
2. **Parâmetros de Input** — informações do projeto, parâmetros gerais, linhas de volumetria/receita/custo (coração dos dados).
3. **Cronograma Físico-Financeiro** — visão derivada dos parâmetros (físicos, receitas, custos ao longo do tempo).
4. **DRE Detalhado + Resumo DRE**
5. **Fluxo de Caixa**
6. **Dashboard inicial do projeto** — KPIs e gráficos específicos do projeto (print de referência já enviado, mas repensável).
7. **Cenários / What-if / Histórico de Versões** — parte sem equivalente direto na planilha original.
8. **Home / Dashboard da organização** — KPIs gerais (contratos ativos, receita bruta total, etc).
9. **Configurações** — perfis da organização, tema claro/escuro, etc.
10. **Login / Esqueci a senha** — mais simples, tratada por último.

**Perguntas bloqueadoras já levantadas para a Tela #1 (Cadastro/Consulta de Projetos), ainda sem resposta do cliente:**
1. Campos mínimos do cadastro inicial (Nome do Projeto, Cliente, Data de Início, Duração, Nome do Contrato, Prazo de Pagamento, Nome da Versão — planilha original; falta decidir se precisa de mais campos: código interno, segmento do cliente final, campo de moeda mesmo que fixo/desabilitado).
2. Colunas/filtros da listagem (nome, cliente, status de ciclo de vida do projeto, módulos vinculados, data de criação) e se precisa de busca livre.
3. Onde ocorre a ação de vínculo entre módulos (inline na listagem vs. tela separada de gestão de vínculos).
4. Onde ocorre a ação de arquivar (inline, com/sem filtro "mostrar arquivados").
5. Confirmar regra de permissão de criação de projeto (Executor e Owner podem, Viewer não pode — já é consistente com a matriz de papéis, mas falta confirmação explícita).
6. Comportamento da tela ao atingir o limite de plano (botão desabilitado com tooltip vs. bloqueio só ao salvar).

---

## 2. Regras fiscais e de cálculo já fechadas

- **Regimes suportados no MVP:** apenas **Lucro Presumido** e **Lucro Real** (Simples Nacional excluído do escopo).
- **Alíquota tributária:** **alíquota efetiva digitada manualmente pelo usuário** (não há motor fiscal estrutural completo — sem RBT12, sem tabela de CNAE, sem apuração automática de PIS/COFINS não-cumulativo). Essa é uma simplificação **consciente** do MVP.
- **Alíquota por linha de receita:** pode haver uma alíquota específica por linha de receita (dedução distinta por tipo de atividade). Se não informada, prevalece a alíquota geral parametrizada no contrato. **Importante:** essa alíquota por linha afeta **apenas dedução de receita** — não muda o regime tributário do contrato, que é único e definido uma vez no cadastro do projeto.
- **Distribuição de volumetria/receita/custo ao longo do tempo:** cálculo automático **linear** (quantidade/prazo) por padrão, mas o usuário pode **editar manualmente** célula a célula quando há ramp-up ou sazonalidade.
  - **Regra de conflito decidida:** se já existem overrides manuais em algum mês e o usuário depois edita o total/prazo da linha, o sistema **bloqueia** a edição do total/prazo até o usuário "resetar" a distribuição manual primeiro (opção mais simples, escolhida para o MVP).
- **Reajuste contratual (IPCA/IGP-M, dissídio, materiais, frota):** **não faz parte do escopo do Viabilidade.** Fica a cargo do módulo Prumo Precificação.
- **VPL / taxa de desconto:** identificado na planilha original que a "Taxa Financeira" é usada tanto para descontar o VPL quanto para calcular custo de captação sobre saldo de caixa negativo — **essa mistura ainda não foi resolvida/decidida formalmente**; fica como ponto em aberto para quando o `01b-business-rules-engine.md` for escrito (deve separar os dois conceitos em dois inputs distintos, conforme já apontado na Fase 1, mas a mecânica exata ainda não foi desenhada em detalhe).
- **Capital de Giro:** na planilha original, é calculado como o pico de necessidade de caixa (maior saldo negativo acumulado), não como Capital de Giro no sentido contábil clássico (AR+Estoque-AP). Rótulo/definição final do produto ainda não foi confirmado — ponto em aberto.
- **Limite de linhas de receita/custo/volumetria:** **sem limite** — deve ser ilimitado (diferente da planilha original, que tinha um teto fixo de linhas).

---

## 3. Modelo de versionamento e cenários

- **Hierarquia única:** Projeto → Versões (não existe uma camada extra de "Cenário" separada de "Versão").
- **What-if é uma versão rascunho**, que só se torna uma versão salva (persistida no histórico) se o usuário confirmar explicitamente ("salvar"). Enquanto não salva, é descartável.
- Ainda não desenhamos o fluxo detalhado de comparação entre versões nem a interface de what-if — isso é justamente o conteúdo da Tela #7 a ser construída no novo chat.

---

## 4. Integração entre módulos (Precificação → Viabilidade → Gestão)

- **Fluxo de dados:** cadeia unidirecional Precificação → Viabilidade → Gestão. Cada seta é "importação por cópia (snapshot), unilateral, sem escrita de volta (upstream nunca é notificado nem alterado)".
- **Vínculo é 1:1 por par adjacente na cadeia** (1 Precificação ↔ 1 Viabilidade ↔ 1 Gestão), ancorado a um `contrato_id` mestre compartilhado entre os 3 módulos — não é vínculo triangular direto.
- **Rastreabilidade:** cada linha importada guarda `origem_line_id` para rastreio (não para leitura ao vivo). Reimportação é ação explícita do usuário, com diff (valor antigo vs. novo) antes de confirmar.
- **Bloqueio de edição:** enquanto um projeto estiver vinculado, a edição manual das linhas importadas é **bloqueada** no módulo downstream (decisão do MVP). Se o usuário desvincular, pode editar livremente — e os valores passam a divergir da origem. O módulo seguinte na cadeia (ex: Gestão lendo da Viabilidade) sempre importa o valor **final decidido** no módulo anterior, já divergente se for o caso — reflete a decisão de negócio, não a origem.
- **Pré-requisito comercial (confirmado, mas sinalizado como passível de revisão):** Gestão exige Viabilidade contratada — não existe fallback direto Precificação→Gestão sem Viabilidade no meio, pelo menos por ora.
- **Contratação:** cada módulo pode ser vendido/contratado standalone (Viabilidade sozinho, Precificação sozinho); Gestão nunca sozinho.

---

## 5. Modelo de conta, organização e papéis

- **1 assinatura = 1 organização** (sem multi-org por assinatura no MVP).
- **Papéis (matriz de permissões já fechada):**
  - **Owner/Admin** — único por organização (não pode haver mais de um Owner). Gerencia faturamento, convite/exclusão de membros, exclusão permanente de projetos.
  - **Analyst/Creator (Executor)** — escrita total: cria projetos, ajusta premissas, edita tabelas, executa simulações, salva versões. Também pode arquivar contratos (confirmado).
  - **Viewer/Executive** — leitura, dashboards, relatórios, comparativos, exportação. Sem escrita.
- **Limite de usuários por plano** conta apenas Executor+Viewer — Owner é sempre adicional, não entra no teto contratado.

---

## 6. Estrutura comercial (já fechada — documento separado "Minuta de Requisitos — Estrutura Comercial Prumo" é a fonte oficial)

- **4 planos:** Starter (Viabilidade OU Precificação, à escolha), Pro Planejamento (Viabilidade+Precificação), Pro Execução (Viabilidade+Gestão), Master (os 3).
- **Tiers são pacotes fechados intencionalmente** — sem contratação à la carte de módulo avulso ou assento avulso no MVP (registrado como backlog v2).
- **Capacidade por tier:** limites fixos de Executor, Viewer e Contratos/Projetos Ativos (ver documento comercial para os números exatos).
- **Contador de "Contratos/Projetos Ativos":** incide sobre o `contrato_id` mestre compartilhado — um projeto vinculado aos 3 módulos consome apenas 1 unidade do limite. "Ativo" significa **cadastro existente** (não tem relação com o status de negociação/execução do projeto, que é dado de negócio do cliente).
- **Arquivamento:** o usuário (Executor ou Owner) pode arquivar um `contrato_id` mestre para liberar vaga no limite sem perder o histórico (leitura preservada). Reversível, sujeito a haver vaga disponível ao desarquivar. Distinto de exclusão permanente (restrita ao Owner).
  - **Nuance ainda não resolvida (sinalizada, não bloqueante):** como o arquivamento incide sobre o `contrato_id` mestre compartilhado, arquivar cascateia para os 3 módulos simultaneamente — não é possível arquivar só a "parte" de um módulo mantendo os demais ativos. Confirmado como comportamento aceito pelo cliente.
- **Downgrade:** bloqueia escrita nos módulos/dados fora do novo tier; leitura e exportação sempre permanecem liberadas.
- **Gatekeeping via `subscription_status` do Stripe:** `active` libera conforme tier; `past_due` mantém leitura, bloqueia escrita; `inactive` bloqueia tudo exceto exportação.

---

## 7. Decisões de arquitetura (não tela, mas contexto que influencia layout/fluxo)

- **Deploy:** monolito único (1 `apps/api` + 1 `apps/web`), módulos controlados por feature-flag/entitlement de plano — não são 3 aplicações separadas.
- **Moeda:** apenas BRL no MVP (multi-moeda/hedge fica para v2).
- Todo cálculo financeiro (impostos, IRPJ, VPL, payback, breakeven, capital de giro) deve rodar no backend — nenhuma regra crítica pode depender do frontend.

---

## 8. O que ainda está em aberto (não fechado em nenhum momento da Fase 1)

- Definição final de layout e fluxo detalhado de todas as 10 telas listadas na seção 1 (esse é justamente o objetivo do novo chat).
- Separação formal, na engine de cálculo, entre taxa de desconto do VPL e custo de capital de giro/overdraft (identificado como problema, ainda sem solução desenhada).
- Definição final do rótulo/cálculo de "Capital de Giro" (pico de caixa negativo vs. definição contábil clássica).
- Fluxo detalhado de comparação de versões e mecânica de what-if (conteúdo da Tela #7).
- As 6 perguntas bloqueadoras da Tela #1, listadas na seção 1 deste resumo.

---

*Documento gerado a partir da Fase 1 (Análise Crítica) do Prumo Viabilidade — uso interno para dar continuidade à construção conjunta das telas em um novo chat.*
