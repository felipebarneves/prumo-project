# PRD — Módulo Prumo Viabilidade

**Autor:** Agente Nexus (PM)
**Módulo:** Prumo Viabilidade (1 de 3 módulos do Ecossistema Prumo)
**Status:** Oficial — pronto para handoff ao Atlas (Arquiteto)
**Fontes:** `docs/handoff/viabilidade/` (12 documentos da Fase 1 — Análise Crítica)

---

## 1. Visão Geral e Objetivo

### 1.1. O Problema da PME

PMEs prestadoras de serviço (construção, facilities, outsourcing operacional) decidem se um contrato "vale a pena" hoje em planilhas Excel frágeis, sem padronização entre projetos, sem histórico de versões auditável e sem visão de fluxo de caixa separada do resultado contábil. Isso gera três dores recorrentes: (1) decisões de viabilidade tomadas sobre premissas desatualizadas ou não rastreáveis; (2) incapacidade de comparar cenários (versões) de forma confiável; (3) confusão entre "lucro no papel" (DRE) e "dinheiro em caixa" (Fluxo de Caixa), que é justamente onde projetos aparentemente lucrativos quebram por falta de capital de giro.

### 1.2. Objetivo do Módulo

O Prumo Viabilidade substitui a planilha de análise de viabilidade de contratos por um produto SaaS multitenant que: cadastra o contrato, parametriza premissas de receita/custo, distribui essas premissas no tempo, calcula automaticamente DRE (competência) e Fluxo de Caixa (caixa), consolida KPIs de decisão (VPL, TIR, TIRM, Payback, Breakeven, Capital de Giro) e permite versionamento/comparação de cenários — tudo com o motor de cálculo rodando 100% no backend, nunca dependente de lógica de frontend.

### 1.3. Posicionamento no Ecossistema Prumo

O Viabilidade é o módulo intermediário de uma cadeia unidirecional de dados: **Precificação → Viabilidade → Gestão**. Cada seta é uma importação por cópia (snapshot), nunca uma leitura ao vivo — o módulo a jusante nunca escreve de volta no módulo a montante. Os três módulos compartilham uma entidade `contrato_id` mestre (1:1 por par adjacente na cadeia), mas Viabilidade pode ser contratado e operado de forma standalone. Gestão nunca é vendido nem opera sem Viabilidade contratado.

### 1.4. Escopo do MVP (10 Telas)

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

### 1.5. Fora do Escopo do MVP (Backlog v2)

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

---

## 2. Histórias de Usuário

### Épico A — Estrutura Comercial e Gatekeeping

**US-A1**
Dado que sou uma organização com assinatura `active` no plano Starter,
Quando tento cadastrar meu 6º contrato,
Então o sistema bloqueia a criação (limite de 5 Contratos Ativos do tier Starter) e exibe a opção de arquivar um projeto existente ou fazer upgrade.

**US-A2**
Dado que minha assinatura está com `subscription_status = past_due`,
Quando tento editar um parâmetro de um projeto existente,
Então o sistema bloqueia a escrita, mas mantém leitura e exportação liberadas.

**US-A3**
Dado que minha assinatura está com `subscription_status = inactive`,
Quando tento visualizar um relatório,
Então apenas a exportação de dados permanece disponível — toda leitura interativa e escrita são bloqueadas.

**US-A4**
Dado que sou Owner e faço downgrade de Master para Starter,
Quando um módulo ou capacidade excedente ao novo tier é acessado,
Então a escrita é bloqueada nesse escopo, mas a leitura e exportação de todos os dados históricos permanecem sempre liberadas.

**US-A5**
Dado que um contrato está arquivado,
Quando o Owner ou Executor tenta desarquivá-lo,
Então o sistema só permite se houver vaga disponível no limite de Contratos Ativos do tier vigente; caso contrário, exibe o mesmo softblock de limite atingido.

### Épico B — Cadastro e Consulta de Projetos (Tela 1)

**US-B1**
Dado que sou Owner ou Executor,
Quando cadastro um novo projeto com Nome do Projeto, Cliente, Data de Início, Duração, Nome do Contrato, Prazo de Pagamento, Nome da Versão e Regime Tributário,
Então o sistema cria o `contrato_id` mestre e a primeira `versao_id` do projeto, com Regime Tributário travado permanentemente.

**US-B2**
Dado que sou Viewer,
Quando acesso a tela de Cadastro/Consulta de Projetos,
Então não vejo nenhuma ação de criar, editar, arquivar ou vincular — apenas visualização e exportação.

**US-B3**
Dado que estou na listagem de projetos,
Quando aplico o filtro "Mostrar arquivados",
Então a listagem passa a incluir projetos arquivados, que ficam ocultos por padrão.

**US-B4**
Dado que meu projeto Viabilidade está vinculado a um projeto Precificação existente na organização,
Quando executo a ação "Vincular módulo",
Então o sistema importa automaticamente por cópia as linhas de Receita/Custo da origem, marcando cada linha com `origem_line_id`.

**US-B5**
Dado que um `contrato_id` mestre está vinculado aos módulos Viabilidade e Precificação,
Quando executo a ação de arquivar,
Então o sistema exibe confirmação explícita nomeando todos os módulos afetados antes de cascatear o arquivamento para os três.

**US-B6**
Dado que sou Owner,
Quando quero remover permanentemente um projeto,
Então apenas eu tenho essa permissão — Executor não pode executar exclusão permanente.

### Épico C — Parâmetros de Input (Tela 2)

**US-C1**
Dado que estou parametrizando uma versão do projeto,
Quando cadastro uma linha de Receita com Volumetria, Unidade de Medida e Valor Unitário,
Então o sistema calcula a Receita total da linha automaticamente (Volumetria × Valor Unitário), sem aceitar valor total como input direto.

**US-C2**
Dado que uma linha de Receita já possui overrides manuais de distribuição na Tela 3,
Quando tento editar a Volumetria total ou o Prazo dessa linha na Tela 2,
Então o sistema bloqueia a edição até que eu execute o Reset de Distribuição na Tela 3.

**US-C3**
Dado que uma linha foi importada de Precificação (`origem_line_id` preenchido),
Quando tento editar o total, prazo ou valor unitário dessa linha,
Então o sistema bloqueia a edição enquanto o vínculo estiver ativo, mas permite a distribuição temporal dessa mesma linha livremente na Tela 3.

**US-C4**
Dado que não preencho a Taxa de Custo de Captação,
Quando o sistema calcula o Custo Financeiro do projeto,
Então o resultado é zero (valor numérico válido), nunca `—`.

**US-C5**
Dado que não preencho a TMA,
Quando o sistema calcula o VPL,
Então o resultado exibido é `—` (não calculado), distinto de zero.

**US-C6**
Dado que cadastro uma linha de Despesa Não Operacional do tipo "Recuperação" com referência à Linha de Receita X,
Quando a receita mensal da Linha X varia mês a mês,
Então o valor da despesa acompanha automaticamente essa variação (Percentual × Receita mensal da referência), somando ao resultado (sinal positivo).

**US-C7**
Dado que estou navegando entre as Telas 2, 3, 4, 5 e 6 do mesmo projeto,
Quando troco a versão no Seletor de Versão do cabeçalho,
Então o contexto de versão muda simultaneamente em todas as telas, com confirmação obrigatória de alterações não salvas apenas nas Telas 2 e 3.

### Épico D — Cronograma Físico-Financeiro (Tela 3)

**US-D1**
Dado que uma linha de Receita não tem overrides manuais,
Quando visualizo o Cronograma,
Então a Volumetria total está distribuída linearmente entre os meses da janela da linha.

**US-D2**
Dado que edito manualmente a Volumetria de um mês específico de uma linha,
Quando a soma das células não bate mais com o total da linha,
Então o sistema exibe um aviso inline visível, sem bloquear o salvamento.

**US-D3**
Dado que um mês está fora da janela de uma linha (antes do Mês de Início ou depois do Mês de Início + Prazo),
Quando visualizo essa célula,
Então ela aparece travada, cinza, com traço (`—`) — visualmente distinta de uma célula dentro da janela com valor zero digitado.

**US-D4**
Dado que quero refazer a distribuição de uma linha do zero,
Quando executo "Reset de Distribuição" nessa linha,
Então todos os overrides manuais são apagados, a linha volta à distribuição linear automática, e os campos Total/Prazo voltam a ficar editáveis na Tela 2 — após confirmação explícita da ação destrutiva.

### Épico E — DRE (Tela 4)

**US-E1**
Dado que tenho linhas de Receita com alíquotas diferentes entre si,
Quando o sistema calcula as Deduções do mês,
Então cada linha é deduzida pela sua própria alíquota antes da soma — nunca a Receita Bruta agregada multiplicada pela alíquota geral.

**US-E2**
Dado que estou visualizando o DRE Detalhado,
Quando reviso a tabela,
Então vejo granularidade mensal fixa, com EBIT Acumulado como a única linha com coluna de acumulado.

**US-E3**
Dado que estou no Resumo DRE,
Quando seleciono granularidade "Anual",
Então os 12 valores mensais de cada linha da DRE são somados dentro de cada ano antes de exibir.

**US-E4**
Dado que visualizo qualquer sub-tela de DRE,
Quando reviso o rodapé,
Então vejo a nota obrigatória informando que o cálculo de IRPJ é simplificado e igual para os dois regimes tributários.

### Épico F — Fluxo de Caixa (Tela 5)

**US-F1**
Dado que meu projeto tem Prazo de Pagamento de 60 dias,
Quando a Receita é reconhecida no mês 5 do DRE,
Então ela entra como Entrada de Caixa no mês 7 do Fluxo de Caixa — enquanto Custos, IRPJ e Despesas Não Operacionais permanecem no mês 5 (competência).

**US-F2**
Dado que o Fluxo Acumulado do mês 4 é negativo,
Quando o sistema calcula o Custo Financeiro do mês 5,
Então ele aplica a Taxa de Custo de Captação sobre o saldo negativo do mês 4 (mês anterior), e esse valor não retroalimenta o próprio Fluxo Acumulado.

**US-F3**
Dado que quero saber o Capital de Giro do projeto,
Quando consulto esse indicador,
Então o sistema retorna o maior valor negativo do Fluxo Acumulado bruto (antes do Custo Financeiro), como um número único.

**US-F4**
Dado que quero calcular VPL/TIR/TIRM,
Quando o motor de cálculo processa esses indicadores,
Então ele usa a série de Saldo de Caixa Final (líquido, já com Custo Financeiro deduzido), nunca o Fluxo Acumulado bruto.

### Épico G — Dashboard do Projeto (Tela 6)

**US-G1**
Dado que a Taxa de Reinvestimento não foi preenchida na Tela 2,
Quando visualizo o card de TIRM no Dashboard,
Então o card permanece visível, exibindo `—` (sem ocultar o card nem substituir pelo valor da TIR clássica).

**US-G2**
Dado que estou no Dashboard do projeto,
Quando clico em um ano específico no gráfico de DRE por Ano,
Então (quando implementado) o gráfico detalha a visão mensal daquele ano — funcionalidade não bloqueante para o lançamento do MVP.

### Épico H — Cenários / What-If / Versões (Tela 7)

**US-H1**
Dado que quero simular uma queda de 10% no Valor Unitário de Receita mantendo o Custo inalterado,
Quando ajusto o dial "Ajuste de Receita (%)" para -10% e mantenho os demais dials em 0%,
Então o sistema recalcula toda a cadeia (Cronograma → DRE → Fluxo de Caixa) com esse ajuste, sem alterar a versão-base, e exibe o resultado lado a lado com o cenário original.

**US-H2**
Dado que tenho uma versão com resultado simulado que aprovo,
Quando busco "promover" essa simulação para uma versão de trabalho real,
Então descubro que não existe esse caminho automático — preciso criar uma nova versão manualmente e replicar os ajustes na Tela 2.

**US-H3**
Dado que um projeto tem apenas 1 versão,
Quando tento excluir essa versão,
Então o sistema bloqueia a exclusão — todo projeto precisa manter ao menos 1 versão.

**US-H4**
Dado que excluo a versão que está atualmente aberta na navegação,
Quando a exclusão é confirmada,
Então o sistema reabre automaticamente a versão mais recente restante do projeto.

**US-H5**
Dado que salvei uma comparação entre a Versão A e a Versão B,
Quando volto a esse item salvo dias depois, após as versões-base terem sido alteradas,
Então o sistema exibe exatamente os valores congelados no momento do salvamento — não recalcula com os dados atuais.

### Épico I — Home da Organização (Tela 8)

**US-I1**
Dado que minha organização tem 5 projetos Viabilidade não-arquivados, cada um com várias versões,
Quando visualizo os cards de KPI da Home,
Então os valores usam sempre a versão mais recente de cada projeto — nunca uma soma entre versões do mesmo projeto.

**US-I2**
Dado que tenho projetos de portes muito diferentes,
Quando visualizo a Margem EBITDA agregada,
Então ela é calculada como EBITDA Total ÷ Receita Bruta Total (razão dos agregados), nunca como média aritmética simples das margens individuais.

### Épico J — Configurações (Tela 9)

**US-J1**
Dado que sou Owner,
Quando convido um novo usuário por e-mail definindo o papel Executor,
Então o convite fica com status `pendente` e não consome vaga no limite de Usuários do plano até o aceite.

**US-J2**
Dado que sou Executor,
Quando tento acessar a seção "Plano Atual" via URL direta,
Então o sistema bloqueia o acesso no backend, mesmo que eu tente contornar a ocultação visual do frontend.

**US-J3**
Dado que quero trocar meu e-mail de cadastro,
Quando submeto o novo e-mail,
Então a alteração só se efetiva após eu confirmar via link enviado ao novo endereço.

### Épico K — Login / Convite (Tela 10)

**US-K1**
Dado que digito uma senha incorreta para um e-mail válido,
Quando o sistema rejeita o login,
Então a mensagem de erro é genérica ("E-mail ou senha incorretos"), sem indicar qual campo está errado.

**US-K2**
Dado que recebo um convite de Owner com papel Viewer pré-definido,
Quando acesso o link de aceite,
Então vejo e-mail e papel pré-preenchidos e não-editáveis, e preencho apenas Nome de Usuário e Senha.

**US-K3**
Dado que aceito um convite,
Quando concluo o cadastro,
Então o convite muda de `pendente` para `aceito`, e é exatamente nesse momento que passo a contar no limite de Usuários do plano.

---

## 3. Regras de Negócio e Fórmulas

### 3.1. Estrutura Comercial

**3.1.1. Planos e módulos incluídos**

| Nível | Módulos |
|---|---|
| Starter | Viabilidade **ou** Precificação (escolha única) |
| Pro Planejamento | Viabilidade + Precificação |
| Pro Execução | Viabilidade + Gestão |
| Master | Viabilidade + Precificação + Gestão |

**Regra:** Gestão nunca é vendido isoladamente. Combinações válidas: Viabilidade sozinho, Precificação sozinho, Viabilidade+Precificação, Viabilidade+Gestão, Viabilidade+Precificação+Gestão. Inválidas: Gestão sozinho; Precificação+Gestão sem Viabilidade.

**3.1.2. Capacidade por tier**

| | Starter | Pro Planejamento | Pro Execução | Master |
|---|---|---|---|---|
| Executor | 1 | 2 | 2 | 3 |
| Viewer | 2 | 3 | 4 | 7 |
| Total usuários | 3 | 5 | 6 | 10 |
| Contratos/Projetos Ativos | 5 | 12 | 15 | 25 |

- Owner é sempre adicional, não conta no limite de usuários.
- Papéis (Executor/Viewer) são fixos por tier na v1 — sem redistribuição livre.
- Limite de usuários é por organização, independente de quantos módulos contratados.
- Limite de usuários e de contratos ativos são contadores **independentes**, ambos teto duro (sem cobrança incremental na v1).

**3.1.3. Contador de Contratos/Projetos Ativos**
- Incide sobre `contrato_id` mestre (entidade compartilhada entre os 3 módulos) — um projeto vinculado aos 3 módulos consome apenas 1 unidade.
- "Ativo" = cadastro existente na organização, sem relação com status de ciclo de vida do projeto (dado de negócio do cliente).
- Arquivamento: `contrato_id` sai da contagem, leitura preservada, reversível (desarquivar sujeito a vaga disponível). Distinto de exclusão permanente (restrita ao Owner).
- Arquivamento cascateia simultaneamente para todos os módulos vinculados ao mesmo `contrato_id` — não é possível arquivar parcialmente.

**3.1.4. Regra de Downgrade**
- Bloqueia escrita (criar, editar, simular) nos módulos/dados fora do novo tier.
- Leitura e exportação sempre permanecem liberadas, em qualquer tier.

**3.1.5. Gatekeeping por `subscription_status` (Stripe)**

| Status | Comportamento |
|---|---|
| `active` | Libera conforme tier contratado |
| `past_due` | Mantém leitura; bloqueia toda escrita |
| `inactive` | Bloqueia tudo, exceto exportação |

**3.1.6. Papéis e permissões (matriz geral)**

| Papel | Escopo |
|---|---|
| Owner (único por organização) | Faturamento, convite/exclusão de membros, exclusão permanente de projetos, todas as permissões de Executor |
| Executor (Analyst/Creator) | Cria projetos, ajusta premissas, edita tabelas, executa simulações, salva versões, arquiva contratos |
| Viewer (Executive) | Leitura, dashboards, relatórios, comparativos, exportação — sem escrita |

**Requisito não-funcional transversal:** toda validação de permissão e de limite de plano deve ser reforçada no backend — nunca depender exclusivamente do estado do frontend.

### 3.2. Cadastro do Projeto (Tela 1)

- Campos obrigatórios: Nome do Projeto, Cliente, Data de Início, Duração, Nome do Contrato, Prazo de Pagamento (`30`\|`60`\|`90` dias — fechado, sem valores intermediários), Nome da Versão, Regime Tributário (`Lucro Presumido`\|`Lucro Real`), Status de Ciclo de Vida, Moeda (fixo `BRL`).
- Campos opcionais: Código Interno, Segmento do Cliente Final.
- **Regime Tributário é imutável após criação** — mudança de regime = novo projeto, nunca edição.
- Enum de Status de Ciclo de Vida (fechado v1): `Em prospecção`, `Contrato assinado`, `Em execução`, `Encerrado`, `Cancelado`. Independente do estado de arquivamento.
- Vínculo entre módulos (Precificação↔Viabilidade↔Gestão): ação restrita a criar/desfazer referência + importação inicial automática por cópia. Reimportação com diff é fora de escopo desta tela.
- Softblock de limite de plano: frontend desabilita ação com tooltip explicativo; backend revalida no submit. Aplica-se a criar projeto e a desarquivar.

### 3.3. Parâmetros de Input (Tela 2)

**Regras gerais:**
- Todo o conteúdo da Tela 2 é escopado por `versao_id`.
- Duas tabelas simétricas e independentes (sem FK obrigatória entre si): Receita e Custo. Alíquota por linha é exclusiva de Receita.
- Valor/Custo total da linha é sempre **calculado**: `Volumetria distribuída no mês × Valor/Custo Unitário` (fixo durante toda a janela da linha) — nunca input direto, nunca editável mês a mês diretamente.

**Parâmetros gerais da versão:**

| Campo | Obrigatório | Regra de nulo |
|---|---|---|
| Alíquota Tributária Efetiva (geral) | Sim | — |
| TMA | Não | Vazio → VPL exibe `—` |
| Taxa de Reinvestimento | Não | Vazio → TIRM exibe `—` |
| Taxa de Custo de Captação | Não | Vazio → Custo Financeiro = 0 (resultado válido, não `—`) |

**Fórmulas de VPL/TIR/TIRM:**
- TIR clássica: sempre calculada, depende só dos fluxos de caixa. Sem troca de sinal → `—`.
- VPL: calculado apenas se TMA preenchida; descontado pela TMA sobre a série de Saldo de Caixa Final (não Fluxo Acumulado bruto, não Lucro Líquido do DRE).
- TIRM: calculada apenas se Taxa de Reinvestimento preenchida (usa TMA + Taxa de Reinvestimento); se nula, exibe `—` (nunca substitui pela TIR clássica).

**Linhas de Receita:** Descrição, Mês de Início (opcional, herda Data de Início do projeto), Prazo (opcional, herda Duração do projeto), Unidade de Medida, Volumetria (≥0), Valor Unitário (≥0, fixo), Alíquota específica opcional (herda a geral se vazia — afeta só dedução de receita, não o regime), `origem_line_id` (se importada).

**Linhas de Custo:** mesma estrutura, sem campo de alíquota.

**Validação de janela:** Mês de Início + Prazo não pode exceder Data de Início + Duração do projeto (bloqueio de input). Única exceção: descasamento de Prazo de Pagamento no Fluxo de Caixa (Tela 5).

**Regra de bloqueio dupla e independente (por linha):**
1. Vínculo com Precificação (`origem_line_id`): bloqueia edição de Total/Prazo/Valor Unitário, **não** bloqueia distribuição temporal (Tela 3).
2. Override manual de distribuição (Tela 3): bloqueia edição de Volumetria (total) e Prazo, **não** bloqueia Valor/Custo Unitário. Liberado apenas via Reset (Tela 3).

Uma linha pode estar sob nenhuma, uma, ou ambas as restrições simultaneamente — avaliadas de forma independente.

**Despesas Não Operacionais (100% derivadas, sem Volumetria, sem janela própria):**
- Campos: Descrição, Tipo (`Despesa` reduz resultado | `Recuperação` aumenta — usuário sempre digita valor positivo, sinal aplicado pelo sistema), Percentual (%), Linha de Receita de referência (opcional — se vazia, aplica sobre a Receita Bruta Total).
- Valor mensal = Percentual × Receita mensal realizada da linha de referência (ou da Receita Bruta Total).
- Linha automática não editável: **Custo Financeiro**, projeção calculada da Taxa de Custo de Captação — não é input, apenas compõe o total no DRE.

**Regras de borda do motor de cálculo:**
- Arredondamento: precisão decimal alta internamente; arredondamento comercial (ABNT, half-up) a 2 casas apenas na exibição/consolidação final.
- Valores negativos: Volumetria e Valor/Custo Unitário bloqueiam input negativo na origem. Zero é válido. Sinal de entrada/saída é decisão do motor no DRE/Fluxo de Caixa, nunca digitado pelo usuário.
- Divisão por zero: Duração ≥ 1 obrigatória (bloqueio de input). Indicadores com denominador zero exibem `—`, nunca erro/infinito/`NaN`.

**Seletor de Versão (componente global — Telas 2, 3, 4, 5, 6):**
- Estado "versão atualmente aberta" é global por projeto, controle visual replicado no cabeçalho das 5 telas.
- Versão mais recente selecionada por padrão.
- Proteção obrigatória contra perda de dado nas Telas 2 e 3 (únicas com edição): confirmação "Salvar / Descartar / Cancelar" antes de trocar de versão com alterações pendentes. Telas 4, 5, 6 (100% leitura) trocam livremente, sem confirmação.

### 3.4. Cronograma Físico-Financeiro (Tela 3)

- Distribuição incide exclusivamente sobre Volumetria; Valor/Custo mensal é sempre derivado (nunca editável diretamente).
- Padrão: distribuição linear (Volumetria total ÷ meses da janela da linha).
- Override manual célula a célula, dentro da janela da linha.
- Validação de soma obrigatória a cada edição, rodando no backend: soma das células deve bater com o total da linha (Tela 2). Divergência gera aviso inline, não bloqueia salvamento.
- Vínculo de origem (`origem_line_id`) **não bloqueia** a distribuição temporal — restrição independente da Tela 2.
- Células fora da janela da linha: cinza, travadas, `—`. Dentro da janela com valor zero: brancas, editáveis, `0`.
- Reset de distribuição: por linha (inline) ou em lote (toda a aba) — ambos com confirmação obrigatória (ação destrutiva). Libera edição de Total/Prazo na Tela 2; não altera Total/Prazo em si.

### 3.5. DRE — Detalhado e Resumo (Tela 4)

Estrutura de cálculo (comum às duas sub-telas):

```
(+) Receita Operacional Bruta (ROB)
(-) Deduções (Impostos sobre Receita)
(=) Receita Operacional Líquida (ROL)
(-) Custos Operacionais
(=) EBITDA
(-) Despesas Não Operacionais
(=) EBIT
(-) IRPJ
(=) Lucro Líquido
```

- **Deduções:** soma de deduções calculadas por linha, cada uma com sua própria alíquota — nunca `Receita Bruta Total × alíquota geral`.
- **IRPJ:** `15% + adicional de 10% sobre o EBIT mensal que exceder R$ 20.000` — fórmula única e simplificada, idêntica para Lucro Presumido e Lucro Real. Calculado mês a mês sobre o EBIT daquele mês (não sobre EBIT acumulado). Nota de rodapé obrigatória em ambas as sub-telas, texto sugerido:
  > *"O cálculo de IRPJ apresentado utiliza uma fórmula simplificada (15% + adicional de 10% sobre o EBIT mensal excedente a R$20.000), aplicada de forma equivalente para os regimes de Lucro Presumido e Lucro Real neste MVP. Não substitui apuração fiscal formal."*
- Margens (EBITDA, EBIT, Líquida) exibidas como % sobre a Receita Bruta do mesmo período.
- **DRE Detalhado:** granularidade mensal fixa; apenas EBIT Acumulado tem coluna de acumulado.
- **Resumo DRE:** granularidade escolhida pelo usuário (trimestral/semestral/anual); mesma estrutura de linhas, valores mensais somados por período.
- Fora de escopo em ambas: qualquer input de dado; ajuste por Prazo de Pagamento; VPL/TIR/TIRM/Capital de Giro/Breakeven/Payback (ficam no Dashboard, Tela 6).

### 3.6. Fluxo de Caixa (Tela 5)

**Regra de deslocamento temporal:** apenas a Receita é deslocada pelo Prazo de Pagamento (30/60/90 dias, Tela 1). Deduções, Custos, IRPJ e Despesas Não Operacionais (exceto Custo Financeiro) permanecem em competência pura.

**Ordem de cálculo (sequencial, obrigatória):**

```
(+) Entrada de Caixa                    [Receita deslocada]
(-) Deduções                            [competência]
(-) Saída de Caixa (Custos)             [competência]
(=) Fluxo Líquido Operacional
(-) Despesas Não Operacionais (exceto Custo Financeiro)  [competência]
(-) IRPJ                                [competência]
(=) Fluxo Líquido Geral
(=) Fluxo Acumulado                     [PASSO 1 — soma cronológica]
---
(-) Custo Financeiro                    [PASSO 2 — sobre Fluxo Acumulado do mês N-1]
(=) Saldo de Caixa Final
```

- **Passo 1:** Fluxo Acumulado = soma cronológica do Fluxo Líquido Geral, mês a mês.
- **Passo 2:** Custo Financeiro do mês N = Taxa de Custo de Captação × saldo negativo do Fluxo Acumulado do mês **N-1** (zero se N-1 for positivo/zero). Não retroalimenta o Fluxo Acumulado (passada única, sem recursão/iteração — simplificação consciente do MVP).
- **Saldo de Caixa Final** = Fluxo Acumulado − Custo Financeiro acumulado até o mês.

**Capital de Giro:** maior valor negativo do Fluxo Acumulado **bruto** (Passo 1, sem Custo Financeiro) ao longo de todo o projeto — número único.

**Base de VPL/TIR/TIRM:** série de **Saldo de Caixa Final** (líquido, com Custo Financeiro deduzido) — nunca o Fluxo Acumulado bruto, nunca o Lucro Líquido do DRE.

**Regra crítica de não-confusão:** Fluxo Acumulado bruto (base de Capital de Giro e Payback) e Saldo de Caixa Final líquido (base de VPL/TIR/TIRM) são duas séries distintas, não intercambiáveis.

Cálculo é sequencial (mês N depende de N-1), não paralelizável — única série com essa característica em toda a suíte.

### 3.7. Dashboard do Projeto (Tela 6)

Todos os cards são 100% derivados (sem input):

| Card | Base | Convenção de ausência |
|---|---|---|
| Receita Bruta Total | Tela 4 | — |
| EBITDA Total | Tela 4 | — |
| Margem EBITDA | Tela 4 | — |
| Fluxo Líquido (Total) | Tela 5 — Saldo de Caixa Final | — |
| VPL | Tela 5 — Saldo de Caixa Final descontado pela TMA | `—` se TMA vazia |
| TIR | Tela 5 — Saldo de Caixa Final | `—` se sem troca de sinal |
| TIRM | Tela 5 — Saldo de Caixa Final + TMA + Taxa de Reinvestimento | `—` se Taxa de Reinvestimento vazia; card sempre visível |
| Payback | Tela 5 — Fluxo Acumulado bruto | `—` se não atingido; mês em que cruza de negativo a positivo |
| Breakeven | Tela 5 — Fluxo Líquido Geral mensal isolado | `—` se não atingido; primeiro mês com resultado mensal positivo |
| Capital de Giro | Tela 5 — Fluxo Acumulado bruto | Maior valor negativo acumulado |
| Custo Financeiro (Total) | Tela 5 | Soma total, sem toggle de ativação/desativação |

Gráficos: DRE por Ano (barras agrupadas: Receita Líquida, Custos, EBITDA) e Fluxo de Caixa por Ano (barras de Fluxo Anual + linha de Caixa Acumulado). Drill-down mensal por clique no ano é desejável, mas não bloqueante para o MVP.

Convenção de "não atingido" em toda a suíte (Telas 2, 4, 5, 6): sempre `—`, nunca zero, erro ou mensagem diferenciada.

### 3.8. Cenários / What-If / Versões (Tela 7)

- Hierarquia única: Projeto → Versões. Sem entidade "Cenário" persistente — "Cenário A/B" são rótulos de posição de UI apontando para Versões reais.
- Toda nova versão é cópia completa e independente das Telas 2 a 5 (sem modelo de delta/herança).
- Sem versão principal/ativa marcada — a mais recente (por data de criação) abre por padrão.
- Sem teto técnico de versões por projeto.
- Vínculo com Precificação (`origem_line_id`) é herdado por versão no momento da cópia, evolui independentemente depois.

**Comparar Versões:** dois seletores (Cenário A/B), tabela lado a lado (Receita Bruta, Impostos, Receita Líquida, Custos Totais, EBITDA, Margem EBITDA, Payback). Ação "Salvar esta comparação" gera snapshot nomeado.

**Simulação What-If:** cálculo paramétrico ao vivo sobre uma versão-base (não gera versão nova nem edição persistida):
- Ajuste de Receita (%): sobre Valor Unitário de todas as linhas de Receita.
- Ajuste de Custo (%): sobre Custo Unitário de todas as linhas de Custo.
- Ajuste de Volumetria — Receita (%): sobre Volumetria total das linhas de Receita — **não afeta** Volumetria de Custo (tabelas independentes; sem correlação assumida pelo motor).
- Reutiliza o motor de cálculo completo (Cronograma → DRE → Fluxo de Caixa) — não há motor simplificado paralelo.
- Sem caminho de "promover simulação a versão real" — requer criação manual de nova versão e replicação dos ajustes na Tela 2.

**Histórico de Versões:** lista com Nome, Criado por (`user_id`), Data de Criação, Status de Vínculo com Precificação, Ações (Abrir, Renomear, Duplicar, Excluir).
- Excluir: permissão Owner/Executor, confirmação obrigatória. **Não é possível excluir a última versão restante de um projeto.** Se a versão excluída é a ativa na navegação, o sistema reabre automaticamente a mais recente restante.

**Salvos:** cada item é snapshot **read-only**, congelado no momento de "Salvar" — não recalcula com dados atuais das versões-base. Aplica-se a comparações e simulações.

**Permissão:** criação de versão, comparação e simulação salvável — Owner e Executor (Viewer não cria/edita, apenas visualiza/exporta).

### 3.9. Home / Dashboard da Organização (Tela 8)

- Escopo restrito ao módulo Viabilidade no MVP (sem mistura com Precificação/Gestão).
- Usa sempre a versão mais recente de cada projeto — nunca soma entre versões do mesmo projeto.
- Projetos arquivados **não** entram na agregação por padrão (sem filtro para incluí-los nesta tela).
- Cards: Receita Bruta Total (soma), EBITDA Total (soma), Margem EBITDA (`EBITDA Total ÷ Receita Bruta Total` — nunca média simples das margens individuais), Contratos Ativos ("X de Y" do tier).
- VPL, TIR, TIRM, Payback, Breakeven, Capital de Giro **não são agregados** — janelas temporais distintas entre projetos tornam a soma/média sem significado financeiro. Permanecem exclusivos da Tela 6 por projeto.
- Projetos sem dados suficientes para gerar KPIs (ex: recém-criados) são excluídos do somatório sem gerar erro.

### 3.10. Configurações (Tela 9)

- Perfil da Organização (Nome, CNPJ): visível a todos, editável apenas por Owner.
- Perfil do Usuário (Nome, E-mail, Senha): self-service, individual. Troca de e-mail exige confirmação via link no novo endereço. Troca de senha exige reautenticação com a senha atual.
- Tema Claro/Escuro: exceção deliberada ao Dark First do playbook — variante clara simplificada (adaptação de paleta, sem redesenho completo de design system). Preferência persistida por usuário, não por organização.
- Gestão de Usuários (Owner-only): convidar (e-mail + papel, gera `pendente`), trocar papel, remover. Convite pendente não conta no limite até aceite.
- Plano Atual (Owner-only, view-only): tier, uso de capacidade, `subscription_status`. Nenhuma lógica de cobrança nesta tela — botão "Gerenciar Assinatura" redireciona ao portal Stripe.
- Controle de acesso a Gestão de Usuários e Plano Atual deve existir em nível de rota/API, não apenas ocultação visual.

### 3.11. Login / Esqueci Senha / Aceite de Convite (Tela 10)

- Autenticação via Supabase Auth, e-mail + senha apenas — sem OAuth/social login no MVP.
- Sem self-signup — toda organização nasce de provisionamento externo ao fluxo de UI; acesso individual só via convite do Owner ou provisionamento do primeiro Owner.
- Mensagens de erro (login e recuperação de senha) seguem princípio de não-enumeração — nunca confirmam/negam explicitamente a existência de um e-mail na base.
- Aceite de Convite: e-mail e papel pré-preenchidos e não-editáveis (definidos pelo Owner). Ao concluir, o convite transiciona de `pendente` para `aceito` — **este é o gatilho exato** que altera a contagem de uso de Usuários do plano.
- Tokens (redefinição de senha, convite) expiram após uso único ou tempo determinado (padrão Supabase Auth); expirado/usado exibe erro claro com orientação.

### 3.12. Regras Transversais Mais Críticas (não-óbvias)

1. `versao_id` é transversal a todo o schema das Telas 2 a 6 — não é migração posterior, é requisito desde o desenho inicial.
2. Seletor de Versão é um único componente (especificado na Tela 2), reutilizado nas Telas 3-6.
3. Fluxo Acumulado bruto (Capital de Giro, Payback) e Saldo de Caixa Final líquido (VPL/TIR/TIRM) são séries distintas — não intercambiáveis.
4. Bloqueio por vínculo de Precificação (`origem_line_id`) tem escopo diferente por tela: bloqueia total/prazo/unitário na Tela 2, não bloqueia distribuição na Tela 3. Vínculo é por versão, não por projeto.
5. Contagem de uso de plano: convite conta só após aceite; contrato arquivado sai da contagem mas mantém leitura; agregação da Tela 8 usa sempre a versão mais recente, nunca soma entre versões.
6. Convenções de nulo/zero não seguem padrão único: TMA e Taxa de Reinvestimento vazias = "não calcular" (`—`); Taxa de Custo de Captação vazia = "calcular como zero" (resultado válido).
7. IRPJ é deliberadamente igual para os dois regimes tributários — Regime Tributário continua obrigatório como metadado e afeta a Alíquota Tributária Efetiva manual, mas não o cálculo de IRPJ.

---

## 4. Critérios de Aceite (Definition of Done)

### 4.1. Estrutura Comercial / Gatekeeping
- [ ] Sistema bloqueia criação/desarquivamento de contrato ao atingir o limite de Contratos Ativos do tier, com softblock (frontend) + validação real (backend).
- [ ] Sistema bloqueia convite de usuário além do limite de Usuários do tier (considerando apenas convites `aceitos`).
- [ ] `subscription_status = past_due` bloqueia toda escrita, mantém leitura/exportação.
- [ ] `subscription_status = inactive` bloqueia tudo exceto exportação.
- [ ] Downgrade bloqueia escrita apenas nos módulos/capacidade fora do novo tier; leitura/exportação nunca são bloqueadas.
- [ ] Arquivar um `contrato_id` cascateia para todos os módulos vinculados, com confirmação nomeando cada módulo afetado.
- [ ] Contador de Contratos Ativos conta 1 unidade por `contrato_id` mestre, independentemente de quantos módulos vinculados.

### 4.2. Cadastro e Consulta de Projetos (Tela 1)
- [ ] Todos os campos obrigatórios são validados no cadastro; Regime Tributário é travado após a criação (não editável em nenhuma tela subsequente).
- [ ] Listagem suporta filtros por Status de Ciclo de Vida, Módulos Vinculados, Arquivado/Não-arquivado (default oculto) e busca livre por nome/cliente.
- [ ] Viewer não vê/consegue executar ações de criar, editar, arquivar, desarquivar ou vincular (validado também via chamada direta de API).
- [ ] Ação de vincular módulo dispara importação inicial automática por cópia, marcando linhas com `origem_line_id`.

### 4.3. Parâmetros de Input (Tela 2)
- [ ] Volumetria e Valor/Custo Unitário bloqueiam input negativo; zero é aceito.
- [ ] Valor/Custo total da linha nunca é campo de input — sempre calculado.
- [ ] Linha com `origem_line_id` bloqueia edição de total/prazo/valor unitário; linha com override de distribuição bloqueia total/prazo (não valor unitário) — as duas condições são avaliadas de forma independente e podem coexistir.
- [ ] VPL exibe `—` quando TMA vazia; TIRM exibe `—` quando Taxa de Reinvestimento vazia; Custo Financeiro calcula como zero quando Taxa de Custo de Captação vazia.
- [ ] Despesa Não Operacional sem Linha de Receita de referência aplica o percentual sobre a Receita Bruta Total.
- [ ] Seletor de Versão exibe confirmação de alterações não salvas (Salvar/Descartar/Cancelar) ao trocar de versão nesta tela.

### 4.4. Cronograma Físico-Financeiro (Tela 3)
- [ ] Distribuição linear é aplicada por padrão a toda linha nova, respeitando a janela (Mês de Início + Prazo).
- [ ] Validação de soma (distribuição vs. total da linha) roda no backend a cada gravação e gera aviso visível em caso de divergência, sem bloquear salvamento.
- [ ] Células fora da janela da linha são visualmente distintas (travadas, `—`) de células dentro da janela com valor zero (editáveis, `0`).
- [ ] Reset de distribuição (individual e em lote) exige confirmação e libera corretamente os campos Total/Prazo na Tela 2.

### 4.5. DRE (Tela 4)
- [ ] Deduções são calculadas por linha de Receita (com sua própria alíquota) antes de somar — validado com ao menos um caso de alíquotas distintas entre linhas.
- [ ] IRPJ aplica corretamente 15% + adicional de 10% sobre o excedente de R$20.000 de EBIT mensal, idêntico para os dois regimes tributários.
- [ ] Nota de rodapé sobre a simplificação do IRPJ está presente em DRE Detalhado e Resumo DRE.
- [ ] Resumo DRE agrega corretamente os valores mensais por trimestre/semestre/ano conforme seleção do usuário.

### 4.6. Fluxo de Caixa (Tela 5)
- [ ] Receita é deslocada corretamente conforme Prazo de Pagamento (30/60/90 dias); Custos, IRPJ e Despesas Não Operacionais (exceto Custo Financeiro) permanecem em competência.
- [ ] Custo Financeiro do mês N é calculado sobre o Fluxo Acumulado do mês N-1, nunca do mês corrente, e não retroalimenta o próprio Fluxo Acumulado (passada única).
- [ ] Capital de Giro retorna o maior valor negativo do Fluxo Acumulado bruto.
- [ ] VPL/TIR/TIRM usam a série de Saldo de Caixa Final líquido — testado com um caso onde bruto e líquido divergem, confirmando que o motor usa a série correta em cada indicador.

### 4.7. Dashboard do Projeto (Tela 6)
- [ ] Todos os 10 cards de KPI exibem valor calculado ou `—` conforme a matriz de condições da seção 3.7 — nenhum card fica oculto condicionalmente (em especial TIRM).
- [ ] Gráficos de DRE por Ano e Fluxo de Caixa por Ano agregam corretamente os dados mensais das Telas 4 e 5 por ano civil do projeto.

### 4.8. Cenários / What-If / Versões (Tela 7)
- [ ] Nova versão copia integralmente Telas 2 a 5 com novos `linha_id`, preservando o estado de vínculo com Precificação no momento da cópia.
- [ ] Simulação what-if recalcula a cadeia completa (Cronograma → DRE → Fluxo de Caixa) sem alterar a versão-base, e sem persistir uma versão nova automaticamente.
- [ ] Exclusão de versão é bloqueada quando é a última restante do projeto; ao excluir a versão ativa, o sistema reabre a mais recente restante.
- [ ] Snapshots salvos (comparação/simulação) permanecem inalterados após mudanças posteriores nas versões-base de origem.

### 4.9. Home da Organização (Tela 8)
- [ ] Cards de Receita Bruta Total, EBITDA Total e Margem EBITDA agregam apenas a versão mais recente de cada projeto não-arquivado.
- [ ] Margem EBITDA agregada é calculada como razão dos totais, validada contra ao menos um caso onde a média simples produziria um valor diferente.
- [ ] VPL/TIR/TIRM/Payback/Breakeven/Capital de Giro não aparecem agregados nesta tela.

### 4.10. Configurações (Tela 9)
- [ ] Troca de e-mail só se efetiva após confirmação via link no novo endereço; troca de senha exige senha atual.
- [ ] Convite pendente não conta no limite de Usuários; aceite (Tela 10) é o único gatilho que move para "aceito" e passa a contar.
- [ ] Gestão de Usuários e Plano Atual são inacessíveis a Executor/Viewer mesmo via chamada direta de API.

### 4.11. Login / Convite (Tela 10)
- [ ] Mensagens de erro de login e de recuperação de senha não revelam se um e-mail existe na base.
- [ ] Aceite de convite exibe e-mail e papel não-editáveis; ao concluir, muda o estado do convite para `aceito`.

### 4.12. Requisitos transversais (Sentinel — QA)
- [ ] RLS/autorização de backend testada para todas as combinações de papel × ação da matriz de permissões (Owner/Executor/Viewer) em todas as 10 telas.
- [ ] Nenhuma regra de cálculo financeiro (impostos, IRPJ, VPL, TIR, TIRM, payback, breakeven, capital de giro) é executada no frontend — toda validada como puramente derivada de chamada de API.
- [ ] Testes matemáticos cobrindo os casos de borda descritos na seção 3.3 (arredondamento, zero, divisão por zero) e a sequência de cálculo do Fluxo de Caixa (seção 3.6).

---

## 5. Requisitos Não-Funcionais

### 5.1. Segurança e Autorização
- Toda regra crítica (permissão de papel, limite de plano, gatekeeping por `subscription_status`, bloqueios de edição por vínculo/override) deve ser validada no backend — o frontend pode replicar a regra para UX, mas nunca é a fonte de verdade.
- RLS (Row Level Security) no Supabase deve refletir a matriz de permissões Owner/Executor/Viewer e o isolamento multitenant por organização.
- Mensagens de erro de autenticação seguem princípio de não-enumeração de e-mails cadastrados.
- Trocas de e-mail e senha exigem confirmação/reautenticação antes de efetivar.

### 5.2. Performance
- Cálculo financeiro completo de uma versão (Cronograma → DRE → Fluxo de Caixa) deve rodar no backend com tempo de resposta compatível com uso interativo (parametrização tela a tela), mesmo em janelas de projeto de múltiplos anos.
- Tela de Parâmetros de Input (Tela 2) validada para a faixa prática de 20-30 linhas por tabela, sem exigência de virtualização/paginação no MVP — sem limite rígido de linhas no schema.
- Cálculo do Fluxo de Caixa é sequencial (mês N depende de N-1) e não paralelizável — dimensionar a implementação considerando essa dependência, diferente das demais projeções da suíte, que são independentes por mês.

### 5.3. Consistência de Dados
- `versao_id` deve ser parte da chave em todo o schema que suporta as Telas 2 a 6 — cada versão mantém um conjunto de dados completo e isolado, sem compartilhamento entre versões do mesmo projeto.
- `origem_line_id` é chave de rastreio (auditoria), não de leitura ao vivo — nenhuma tela deve consultar o módulo de origem em tempo real.
- Arredondamento comercial aplicado apenas na camada de apresentação/consolidação — cálculo interno em precisão decimal alta, para evitar distorção acumulada ao longo de projetos de múltiplos anos.

### 5.4. UX e Acessibilidade
- Produto é Dark First por padrão (playbook de arquitetura); tema claro (Tela 9) é uma adaptação de paleta simplificada, não um segundo design system com o mesmo rigor de contraste/acessibilidade.
- Convenção única de "não calculado"/"não atingido" (`—`) em todas as telas e KPIs — nunca zero, erro ou mensagem ad hoc.
- Ações destrutivas (reset de distribuição, exclusão de versão, exclusão permanente de projeto, arquivamento em cascata) exigem confirmação explícita nomeando o efeito da ação.

### 5.5. Arquitetura e Deploy
- Deploy em monolito único (1 `apps/api` + 1 `apps/web`) — módulos controlados por feature-flag/entitlement de plano, não por aplicações separadas.
- Apenas BRL no MVP — sem suporte a multi-moeda ou hedge cambial.
- Módulo opera de forma standalone (Viabilidade sozinho é uma combinação comercial válida), mas compartilha a entidade `contrato_id` mestre com Precificação e Gestão quando vinculado.

### 5.6. Auditoria
- Ações sensíveis (criação de versão, exclusão de versão, arquivamento, exclusão permanente, convite/remoção de usuário) devem registrar autor (`user_id`) e timestamp, consistente com o requisito de rastreabilidade já identificado para a coluna "Criado por" do Histórico de Versões (Tela 7).

---

## 6. Pontos em Aberto — Não Bloqueiam o MVP, Mas Devem Ser Rastreados

- Separação formal, na engine de cálculo, entre taxa de desconto do VPL (TMA) e custo de capital de giro/overdraft (Taxa de Custo de Captação) — hoje resolvida operacionalmente (dois inputs distintos), mas sem mecânica de interação formalmente desenhada além do já especificado na seção 3.6.
- Definição final do rótulo/conceito de "Capital de Giro" para efeitos de comunicação com o cliente — hoje definido tecnicamente como pico de caixa negativo acumulado, distinto da definição contábil clássica (AR+Estoque-AP).
- Fluxo de reimportação subsequente com diff (valor antigo vs. novo) entre módulos vinculados — fora do escopo das 10 telas atuais, a ser especificado em iteração futura.

---

*PRD gerado pelo Agente Nexus (PM) a partir dos 12 documentos de handoff da Fase 1 (Análise Crítica) do Prumo Viabilidade — pronto para handoff ao Agente Atlas (Arquiteto) para elaboração de `01-database-schema.md`, `01b-business-rules-engine.md`, `03-frontend-ux.md` e `04-auth-integrations.md`.*
