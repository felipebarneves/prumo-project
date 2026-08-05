# Especificação de Tela — Handoff para Agente Nexus (PM)
### Módulo: Prumo Viabilidade | Tela 7/10: Cenários / What-If / Histórico de Versões

> Serve de input para `01-database-schema.md`, `01b-business-rules-engine.md` e `03-frontend-ux.md` do módulo Viabilidade. Pressupõe as Telas 1 a 6 já especificadas. Sem equivalente na planilha original — construída inteiramente na Fase 1, sem layout de referência prévio (exceto o modelo de comparação validado nesta rodada).

---

## 1. Objetivo

Tela onde o usuário gerencia o histórico de versões de um projeto, compara duas versões lado a lado, e roda simulações paramétricas simplificadas (what-if) sem alterar dados reais. Quatro sub-abas: **Comparar Versões**, **Simulação What-If**, **Histórico de Versões**, **Salvos**.

---

## 2. Estrutura de Dados — Versões

- Hierarquia única: **Projeto → Versões** (decisão já fechada na Fase 1 — não existe camada de "Cenário" como entidade persistente; "Cenário A"/"Cenário B", usados nas sub-abas desta tela, são rótulos de posição de comparação na UI, sempre apontando para Versões reais já existentes).
- Cada nova versão é uma **cópia completa e independente** de todos os dados das Telas 2 a 5 (Parâmetros Gerais, linhas de Receita, Custo, Despesas Não Operacionais, distribuição temporal do Cronograma) — não um modelo de delta/herança.
- **Sem versão principal/ativa marcada.** Todas as versões têm o mesmo status; a mais recente (por data de criação) abre por padrão ao entrar no projeto via Tela 1.
- **Sem limite técnico de versões por projeto** — mesmo padrão já adotado para linhas de Receita/Custo (sem teto rígido, mas sem necessidade de estratégia de UI além de lista simples, dado que a expectativa prática de uso gira em torno de poucas dezenas de versões por projeto).
- **Vínculo com Precificação (`origem_line_id`) é por versão**, não por projeto — cada versão nova herda o estado de vínculo da versão de origem no momento da cópia, mas pode ser desvinculada/revinculada independentemente das demais versões do mesmo projeto a partir daí.
- **Permissão de criação de versão (nova versão, duplicar, salvar comparação/simulação):** Owner e Executor — mesma matriz de permissão já fechada na Tela 1 para criação de projeto (Viewer não cria/edita, apenas visualiza e exporta).

---

## 3. Sub-aba: Comparar Versões

- Dois seletores de versão (Cenário A / Cenário B), cada um listando as versões já salvas do projeto.
- Tabela de resultado lado a lado, mesma estrutura para as duas colunas:

| Métrica | Fonte |
|---|---|
| Receita Bruta | Tela 4 |
| Impostos (Deduções) | Tela 4 |
| Receita Líquida | Tela 4 |
| Custos Totais | Tela 4 |
| EBITDA | Tela 4 |
| Margem EBITDA | Tela 4 |
| Payback | Tela 5 / Tela 6 |

- Ação "Salvar esta comparação": grava um snapshot nomeado pelo usuário, listado na sub-aba Salvos (seção 6).

---

## 4. Sub-aba: Simulação What-If

**Natureza da ferramenta:** simulação simplificada de nível de esforço ("quanto preciso melhorar X para atingir Y"), não uma versão de trabalho editável linha a linha. Não há edição manual de parâmetros individuais nem versão temporária persistida no banco — é um cálculo paramétrico ao vivo sobre uma versão-base já existente.

- Seleção de uma versão-base (uma só, não duas).
- Três diais percentuais de ajuste, aplicados sobre a versão-base:
  - **Ajuste de Receita (%):** aplicado uniformemente sobre o Valor Unitário de todas as linhas da Tabela de Receita.
  - **Ajuste de Custo (%):** aplicado uniformemente sobre o Custo Unitário de todas as linhas da Tabela de Custo.
  - **Ajuste de Volumetria — Receita (%):** aplicado uniformemente sobre a Volumetria total de todas as linhas da Tabela de Receita. Rótulo explícito na UI ("Ajuste de Volumetria (Receita)") — **não afeta a Volumetria de Custo**, que é uma tabela independente (decisão já fechada na Tela 2). Não há vínculo automático entre as duas volumetrias: se o usuário quer simular o efeito de uma queda de volume também no custo, ajusta o dial de Custo manualmente, na mesma simulação. Nenhuma correlação é assumida pelo motor.
- **Motor de cálculo:** reutiliza o motor completo já especificado (Cronograma → DRE → Fluxo de Caixa), sem aproximação simplificada separada — os percentuais são aplicados nos inputs de origem (Volumetria, Valor/Custo Unitário) e o cálculo roda pela mesma cadeia de telas já fechada. Não há um segundo motor "rápido" para simulação.
- Resultado exibido na mesma tabela de comparação da seção 3, lado a lado: Versão-base (sem ajuste) vs. Resultado Simulado (com os três percentuais aplicados).
- Ação "Salvar Cenário": grava snapshot nomeado, read-only, listado em Salvos.

**Fora de escopo desta sub-aba:** a simulação não gera automaticamente uma nova Versão persistida — se o usuário decidir que o resultado simulado deve virar uma versão de trabalho real, ele precisa criar uma nova versão manualmente e replicar os ajustes nos parâmetros de origem (Tela 2). O what-if não tem caminho direto de "promover a versão".

---

## 5. Sub-aba: Histórico de Versões

Lista dedicada de todas as versões do projeto — diferente do Seletor de Versão do cabeçalho (Tela 2, seção 2b), que é um controle compacto de troca rápida. Esta sub-aba é o local de consulta e gestão completa do histórico.

**Colunas da listagem:**

| Coluna | Observação |
|---|---|
| Nome da Versão | Definido na criação (Tela 1, para a primeira versão; ação de nova versão, para as demais) |
| Criado por | Usuário (Owner/Executor) que executou a ação de criação da versão |
| Data de Criação | |
| Status de Vínculo com Precificação | Indicador se aquela versão específica está vinculada ou não (vínculo é por versão — seção 2) |
| Ações | Abrir, Renomear, Duplicar, Excluir (ver regras abaixo) |

**Ações disponíveis:**
- **Abrir:** define aquela versão como a versão ativa de navegação — mesmo efeito de selecioná-la no Seletor de Versão do cabeçalho (Tela 2, seção 2b), incluindo a mesma proteção de alterações não salvas se disparada a partir de uma tela com edição pendente.
- **Renomear:** edita o Nome da Versão, sem efeito em nenhum outro dado.
- **Duplicar:** cria uma nova versão como cópia completa da versão selecionada — mesmo mecanismo de "nova versão" (seção 2), apenas com um ponto de partida explícito diferente da versão mais recente.
- **Excluir:** exclusão permanente da versão. Permissão: Owner e Executor (mesmo critério de criação/salvamento — seção 2). **Alerta de confirmação obrigatório antes de executar** — ex.: *"Esta ação vai excluir permanentemente a versão '[Nome da Versão]' e todos os seus dados. Esta ação não pode ser desfeita. Deseja continuar?"* Duas regras de segurança adicionais:
  - Não é possível excluir a **única versão restante** de um projeto — todo projeto precisa ter ao menos uma versão sempre.
  - Se a versão excluída for a que está atualmente aberta na navegação, o sistema reabre automaticamente a versão mais recente restante (mesma regra padrão de abertura já fechada).

---

## 6. Sub-aba: Salvos

- Lista de comparações e simulações salvas pelo usuário (contador exibido no rótulo da aba, ex: "Salvos (1)").
- **Cada item é um snapshot read-only** — congela os valores resultantes no momento em que "Salvar" foi acionado. Reabrir um item salvo não recalcula com os dados atuais das versões-base; exibe exatamente o que foi salvo naquele momento. Se as versões-base mudarem depois, o snapshot salvo não reflete a mudança.
- Aplica-se igualmente a comparações (seção 3) e simulações what-if (seção 4) — mesma mecânica de congelamento.

---

## 7. Fora de Escopo desta Tela

- **Modelo de delta/herança entre versões:** decisão descartada — toda versão é cópia completa.
- **Versão principal/ativa marcada:** não existe; mais recente abre por padrão.
- **Edição livre de parâmetros dentro do what-if:** apenas os três diais percentuais — sem acesso a edição linha a linha nesta tela.
- **Vínculo automático entre Volumetria de Receita e Volumetria de Custo no dial de simulação:** avaliado e descartado — ajuste manual e independente dos dois dials, se o usuário quiser simular o efeito conjunto.
- **Promoção automática de simulação what-if para versão real:** requer ação manual do usuário fora desta tela.
- **Comparação de mais de duas versões simultaneamente ou granularidade mensal completa na comparação:** escopo restrito a duas versões e métricas consolidadas (nível Dashboard), conforme seção 3.

---

## 8. Decisões Técnicas/Fronteiras (input para Nexus)

- **Nota retroativa importante:** todo o schema já especificado nas Telas 2 a 5 (linhas de Receita, Custo, Despesas Não Operacionais, distribuição temporal do Cronograma, resultados de DRE e Fluxo de Caixa) precisa ter `versao_id` como parte da chave — essas telas foram documentadas assumindo implicitamente uma única versão por projeto; a partir desta tela, fica explícito que múltiplas versões coexistem, cada uma com seu conjunto completo e independente desses dados.
- `origem_line_id` (vínculo com Precificação) é copiado por versão no momento da criação de uma nova versão, mas seu estado de vínculo/desvínculo evolui independentemente a partir daí — não há sincronização entre versões do mesmo projeto após a cópia inicial.
- Simulação what-if não requer schema de persistência própria além do snapshot opcional (seção 6) — o cálculo em si roda sob demanda, sobre os dados já existentes da versão-base, sem gravação intermediária.
- Snapshots salvos (comparação ou simulação) são registros read-only, independentes das versões que os originaram — alterações posteriores nas versões-base não devem propagar para snapshots já salvos.
- Sem teto técnico de versões por projeto no schema — mesma filosofia já aplicada a linhas de Receita/Custo (Tela 2): ilimitado por design, sem necessidade de paginação/virtualização na lista de versões para o volume de uso esperado no MVP.
- Ação de Excluir versão (seção 5) requer validação de backend em duas frentes: (a) contagem mínima de 1 versão restante por projeto — bloqueio de exclusão se for a última; (b) se a versão excluída for a versão ativa de navegação da sessão do usuário, o backend deve indicar qual versão substituta (mais recente restante) o frontend deve carregar em seguida.
- Coluna "Criado por" (seção 5) requer que o registro de versão armazene o `user_id` do autor da ação de criação — metadado de auditoria não mencionado nas telas anteriores; consistente com o princípio geral de rastreabilidade já aplicado a outras ações sensíveis do módulo (ex: arquivamento, exclusão).

---

*Documento gerado a partir da Fase 1 (Análise Crítica) do Prumo Viabilidade — pronto para colar no Agente Nexus (PM) junto aos documentos anteriores já fechados.*
