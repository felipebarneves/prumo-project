# Especificação de Tela — Handoff para Agente Nexus (PM)
### Módulo: Prumo Viabilidade | Tela 2/10: Parâmetros de Input

> Serve de input para `01-database-schema.md`, `01b-business-rules-engine.md` e `03-frontend-ux.md` do módulo Viabilidade. Pressupõe a Tela 1 já especificada — o projeto já existe com regime tributário definido e imutável.

---

## 1. Objetivo

Tela onde o usuário parametriza os totais financeiros e físicos de **uma versão** do projeto: parâmetros gerais da versão, duas tabelas de linhas operacionais (Receita e Custo) e uma tabela de linhas derivadas (Despesas Não Operacionais). É a tela mais estrutural do módulo — Cronograma, DRE, Fluxo de Caixa e Dashboard derivam dela. Todo o conteúdo desta tela é escopado por `versao_id` (modelo Projeto → Versões, formalizado na Tela 7): cada versão do projeto tem seu próprio conjunto completo e independente desses dados.

---

## 2. Estrutura de Dados — Duas Tabelas Simétricas

O projeto tem **duas tabelas de linhas**, estruturalmente simétricas entre si:

1. **Receita** — cada linha combina Volumetria (quantidade total), Unidade de Medida e Valor Unitário, mesmo `linha_id`, mais uma Alíquota específica opcional.
2. **Custo** — cada linha combina Volumetria de Custo (quantidade total), Unidade de Medida e Custo Unitário, mesmo `linha_id`.

As duas tabelas são independentes — não há vínculo estrutural obrigatório entre uma linha de Receita e uma de Custo; a correspondência entre elas (ex: mesmo serviço, mesma unidade) é decisão livre do usuário, não uma chave estrangeira do schema. A única assimetria entre as duas é o campo de alíquota, exclusivo de Receita (seção 4).

**Relação Volumetria → Valor (decisão estrutural):** a distribuição temporal é definida uma única vez, sobre a Volumetria. O Valor (Receita ou Custo) nunca é distribuído de forma independente — é sempre **calculado** como Volumetria distribuída no mês × Valor/Custo Unitário (constante, fixo durante toda a janela da linha). Não há edição manual de valor mês a mês; o único ponto de override manual é a Volumetria, na Tela 3.

Cada linha guarda apenas **totais e parâmetros unitários** nesta tela — a distribuição mês a mês da Volumetria (linear ou manual) é responsabilidade da Tela 3 (Cronograma), não desta (seção 6).

---

## 2b. Seletor de Versão (Componente Global de Navegação)

**Decisão de escopo:** o estado de "versão atualmente aberta" é **global por projeto** — persiste enquanto o usuário navega entre as Telas 2, 3, 4, 5 e 6 do mesmo projeto. O controle visual do seletor, no entanto, é renderizado no cabeçalho de **cada uma dessas cinco telas** (componente compartilhado, não uma tela própria). Esta seção define a mecânica uma única vez; as Telas 3, 4, 5 e 6 referenciam esta especificação em vez de repeti-la.

- Seletor lista as versões do projeto (modelo Projeto → Versões, Tela 7), ordenadas por data de criação — a mais recente é a selecionada por padrão ao entrar no projeto.
- Trocar a versão no seletor altera o contexto de **todas** as telas simultaneamente — não é possível estar em versões diferentes em telas diferentes ao mesmo tempo.
- **Proteção contra perda de dado (obrigatória, não opcional):** nas Telas 2 e 3 — as únicas com edição direta (parâmetros, linhas, distribuição manual) — se houver alterações não salvas no momento em que o usuário aciona o seletor, o sistema exibe confirmação explícita antes de trocar: *"Você tem alterações não salvas. Deseja salvar antes de trocar de versão?"*, com opções **Salvar** / **Descartar** / **Cancelar**.
- Nas Telas 4, 5 e 6 — 100% leitura, sem edição — a troca de versão é livre, sem confirmação, porque não há risco de perda de dado.

---

## 3. Parâmetros Gerais da Versão

| Campo | Obrigatório | Observação |
|---|---|---|
| Alíquota Tributária Efetiva (geral) | Sim | Digitada manualmente. Simplificação consciente do MVP — sem RBT12, CNAE ou apuração automática. Aplica-se a toda linha de Receita sem alíquota específica. |
| Taxa Mínima de Atratividade (TMA) | Não | Desconta fluxos futuros no cálculo de VPL; também referência de comparação com a TIR ("TIR > TMA" = indicativo de viabilidade). |
| Taxa de Reinvestimento | Não | Usada junto com a TMA para calcular TIR Modificada (TIRM/MIRR). |
| Taxa de Custo de Captação | Não | Custo financeiro sobre saldo de caixa negativo acumulado. Distinta da TMA — nunca reutiliza o mesmo valor. Se não preenchida, o custo financeiro do projeto é calculado como zero (resultado válido, não `—`). |

Regime Tributário não aparece nesta tela — já foi definido de forma imutável na Tela 1.

**Regra de nulo vs. zero:** campos de taxa distinguem vazio/nulo (taxa não informada) de zero explícito (taxa real de 0%, valor válido). Zero não é usado como sentinela de ausência.

**Atenção — dois comportamentos distintos para campo vazio, não confundir no engine:** para TMA e Taxa de Reinvestimento, vazio significa "não calcular o KPI" (exibe `—`). Para Taxa de Custo de Captação, vazio significa "calcular com custo financeiro zero" (resultado numérico válido). São regras opostas e precisam ser implementadas como tal no `01b-business-rules-engine.md`.

**Cálculo de VPL/TIR/TIRM:**
- TIR clássica é sempre calculada — depende só dos fluxos de caixa, sem taxa como input. Fluxo sem troca de sinal não tem raiz real → exibe `—`.
- VPL é calculado apenas se a TMA estiver preenchida; se nula, exibe `—`.
- TIRM é calculada apenas se a Taxa de Reinvestimento estiver preenchida (usa TMA + Taxa de Reinvestimento); se nula, exibe `—` (não substitui pelo valor da TIR clássica — mesma convenção de "não calculado" usada nos demais campos desta tela).

---

## 4. Tabela de Receita

| Campo | Observação |
|---|---|
| Descrição da linha | Texto livre |
| Mês de Início da linha | Opcional — se vazio, herda a Data de Início do projeto (Tela 1) |
| Prazo da linha (meses) | Opcional — se vazio, herda a Duração do projeto (Tela 1) |
| Unidade de Medida | Texto livre curto (ex: "hora", "unidade", "posto") |
| Volumetria (quantidade total) | Bloqueia negativo (seção 7) |
| Valor Unitário | Fixo durante toda a janela da linha — não varia mês a mês. Bloqueia negativo. Receita total da linha é calculada (Volumetria distribuída × Valor Unitário), não é campo de input direto. |
| Alíquota específica da linha | Opcional — se vazia, herda a Alíquota geral (seção 3). Afeta apenas dedução de receita, não o regime tributário do contrato. |
| Origem (`origem_line_id`) | Presente somente se a linha foi importada de Precificação (seção 8). Importação carrega também Descrição da linha e Unidade de Medida da origem. |

**Validação de janela:** Mês de Início + Prazo da linha não pode exceder os limites de Data de Início + Duração do projeto — bloqueio de input, sem exceção nesta tela. A única exceção a essa contenção ocorre no Fluxo de Caixa (Tela 5), pelo descasamento de recebimento em função do Prazo de Pagamento (Tela 1) — efeito derivado, tratado quando a Tela 5 for especificada.

**Bloqueio por override de distribuição (regra de conflito, referenciada pela Tela 3):** se a linha já possui overrides manuais de distribuição de Volumetria na Tela 3, os campos **Volumetria (total)** e **Prazo da linha** ficam bloqueados para edição nesta tela — o usuário precisa executar "Reset de Distribuição" (Tela 3, seção 5) antes de poder alterá-los. Este bloqueio é **independente** do bloqueio por vínculo com Precificação (seção 8): uma linha pode estar bloqueada por um motivo, pelo outro, ou por ambos ao mesmo tempo. Valor/Custo Unitário não é afetado por esta regra — permanece editável mesmo com overrides de distribuição existentes, desde que a linha não esteja também bloqueada por vínculo de importação.

**UI:** sem limite de linhas na regra de negócio, mas a estratégia de tela é formulário de tabela simples (sem virtualização/paginação) — validado como suficiente para a faixa prática de 20-30 linhas por projeto.

---

## 5. Tabela de Custo

| Campo | Observação |
|---|---|
| Descrição da linha | Texto livre — sem vínculo estrutural obrigatório com a Tabela de Receita |
| Mês de Início da linha | Opcional — se vazio, herda a Data de Início do projeto (Tela 1) |
| Prazo da linha (meses) | Opcional — se vazio, herda a Duração do projeto (Tela 1) |
| Unidade de Medida | Texto livre curto |
| Volumetria de Custo (quantidade total) | Bloqueia negativo |
| Custo Unitário | Fixo durante toda a janela da linha. Bloqueia negativo. Custo total da linha é calculado (Volumetria distribuída × Custo Unitário), não é campo de input direto. |
| Origem (`origem_line_id`) | Presente somente se a linha foi importada de Precificação (seção 8). Importação carrega também Descrição da linha e Unidade de Medida da origem. |

**Validação de janela:** mesma regra da Tabela de Receita.

**Bloqueio por override de distribuição:** mesma regra da Tabela de Receita (seção 4) — Volumetria de Custo e Prazo bloqueados enquanto existirem overrides de distribuição na Tela 3, até reset.

Sem campo de alíquota — exclusivo de Receita.

---

## 5b. Tabela de Despesas Não Operacionais

Tabela de linhas 100% derivadas — sem Volumetria, sem valor manual, sem janela própria e sem entrada na Tela 3 (Cronograma). Cada linha é um percentual aplicado mês a mês sobre a receita mensal realizada de uma linha de referência.

| Campo | Observação |
|---|---|
| Descrição | Texto livre |
| Tipo | `Despesa` \| `Recuperação` — define o sinal no cálculo (Despesa reduz resultado, Recuperação aumenta). Usuário sempre digita valor/percentual positivo; o sinal é aplicado pelo sistema conforme o Tipo escolhido. |
| Percentual (%) | Aplicado mês a mês sobre a receita mensal realizada da Linha de Receita de referência — segue automaticamente o ritmo da receita de origem, sem necessidade de distribuição própria. |
| Linha de Receita de referência | Opcional — seleção entre as linhas da Tabela de Receita (seção 4). Se vazio, aplica sobre a Receita Bruta Total do projeto (soma de todas as linhas de Receita, mês a mês). |

**Linha automática adicional (não editável pelo usuário, sempre presente):** Custo Financeiro — calculado a partir da Taxa de Custo de Captação já parametrizada (seção 3). Não é um input desta tabela, apenas aparece como linha de resultado dentro dela para compor o total de Despesas Não Operacionais no DRE (Tela 4).

---

## 6. Fronteira com a Tela 3 (Cronograma)

A Tela 2 define os totais e parâmetros unitários por linha. A distribuição ao longo do tempo — linear por padrão, ou manual célula a célula (ramp-up, sazonalidade) — incide **exclusivamente sobre a Volumetria** e é uma visão derivada que pertence à Tela 3. O Valor/Custo em cada mês é sempre calculado a partir da Volumetria distribuída daquele mês, nunca editado diretamente.

**Validação de soma:** a distribuição mês a mês da Volumetria (automática ou com overrides manuais) deve sempre somar exatamente o total da linha definido nesta tela. Se não bater, a Tela 3 exibe aviso — essa regra vale para toda linha, vinculada a Precificação ou não; vínculo com Precificação não bloqueia a distribuição temporal na Tela 3 (distribuição é decisão operacional de Viabilidade, distinta da precificação unitária definida no módulo de origem).

---

## 7. Regras de Borda do Motor de Cálculo

| Caso | Regra |
|---|---|
| Arredondamento | Cálculo interno em precisão decimal alta, sem arredondamento em etapas intermediárias. Arredondamento comercial (ABNT, half-up) para 2 casas aplicado apenas na exibição e na consolidação final por período/mês. |
| Valores negativos | Volumetria, Valor/Custo Unitário bloqueiam input negativo na origem. Zero é válido. Sinal de entrada/saída é decisão do motor de cálculo no DRE/Fluxo de Caixa — nunca digitado pelo usuário. |
| Divisão por zero | Duração ≥ 1 período obrigatório (bloqueio de input). Indicadores derivados com denominador zero exibem `—` — nunca erro, infinito ou `NaN`. |

---

## 8. Bloqueio de Linhas Importadas (Vínculo com Precificação)

O bloqueio de edição na Tela 2 é **por linha**, via `origem_line_id` — não trava a tabela inteira.

- Linhas com `origem_line_id` preenchido são marcadas como "Importada" e não editáveis (total, prazo, valor unitário) enquanto o vínculo estiver ativo. A importação carrega Descrição da linha e Unidade de Medida da origem, além dos valores numéricos.
- Linhas sem `origem_line_id` permanecem editáveis normalmente, na mesma tabela, lado a lado com as importadas.
- Ao desvincular o projeto de Precificação, as linhas antes importadas passam a ser editáveis livremente e podem divergir da origem a partir daí.
- **Este bloqueio não se estende à distribuição temporal na Tela 3** — ver seção 6.
- Reimportação com diff (valor antigo vs. novo) é ação fora do escopo desta tela — fluxo a ser especificado separadamente.

---

## 9. Fora de Escopo desta Tela

- **Capital de Giro:** KPI calculado a partir do Fluxo de Caixa (Tela 5 — pico de saldo negativo acumulado), exibido no Dashboard do projeto (Tela 6). Não é campo de input aqui.
- **Reimportação com diff:** seção 8.
- **Reajuste contratual** (IPCA/IGP-M, dissídio, materiais, frota): pertence ao Prumo Precificação.
- **Variação de Valor/Custo Unitário ao longo do tempo:** fixo por decisão de escopo — qualquer reajuste de preço dentro da vida da linha é tratado no Precificação, não no Viabilidade.

---

## 10. Decisões Técnicas/Fronteiras (input para Nexus)

- Schema com duas tabelas simétricas (Receita; Custo), cada uma com seu próprio `linha_id`, sem FK obrigatória entre elas. Alíquota por linha existe apenas no schema de Receita.
- Cada linha armazena Volumetria total, Unidade de Medida e Valor/Custo Unitário — nunca um "valor total" como campo de input direto; valor total é sempre calculado (Volumetria × Unitário), inclusive por mês, na Tela 3.
- Distribuição mês a mês incide apenas sobre Volumetria — não existe schema de distribuição de valor independente. Valor por mês é uma coluna derivada, não persistida como input.
- Todo cálculo (arredondamento, sinal, indicadores derivados, VPL/TIR/TIRM) roda no backend — nenhuma regra crítica depende do frontend.
- `origem_line_id` é chave de rastreio, não de leitura ao vivo — consistente com a importação por cópia/snapshot já fechada. Importação replica também nome (Descrição) e Unidade de Medida da linha de origem, não apenas valores numéricos.
- Campos de taxa (TMA, Taxa de Reinvestimento) exigem coluna nullable, sem default 0 — a lógica de cálculo de VPL/TIRM depende de checar nulidade, não valor. Taxa de Custo de Captação segue regra oposta (nulo = calcula como zero).
- Mês de Início e Prazo por linha (Receita e Custo) são opcionais com fallback para os parâmetros gerais do projeto (Tela 1) — herança de valor, não duplicação de dado. Ambos sujeitos a validação de contenção dentro da janela do projeto.
- Prazo de Pagamento (campo já cadastrado na Tela 1) é seleção fechada v1 (30/60/90 dias). Gera a única exceção à contenção de janela do projeto — efeito de descasamento de recebimento no Fluxo de Caixa (Tela 5), não uma exceção do modelo de dados desta tela.
- Vínculo com Precificação bloqueia edição de total/prazo/unitário na Tela 2, mas não bloqueia a distribuição temporal na Tela 3 — são duas camadas de bloqueio distintas e independentes.
- **Segunda camada de bloqueio, independente da anterior:** existência de override manual de distribuição (Tela 3) bloqueia edição de Volumetria (total) e Prazo na Tela 2 — não bloqueia Valor/Custo Unitário. Liberado somente via ação de Reset (Tela 3, seção 5). O `01-database-schema.md` e o `03-frontend-ux.md` devem tratar esta condição e a condição de vínculo com Precificação como duas flags/checagens independentes, avaliadas em conjunto (uma linha pode estar sob nenhuma, uma, ou ambas as restrições simultaneamente).
- Despesas Não Operacionais não têm schema de distribuição temporal próprio — o valor mensal é sempre calculado em tempo de leitura (Percentual × Receita mensal da linha de referência, ou da Receita Bruta Total se referência vazia). Não gera registro na tabela de overrides da Tela 3.
- Linha de Custo Financeiro dentro de Despesas Não Operacionais não é um registro de linha independente — é uma projeção calculada da Taxa de Custo de Captação (seção 3), exibida junto às demais linhas desta tabela apenas para composição do total no DRE.
- IRPJ (calculado na Tela 4 — DRE) usa fórmula única e simplificada para os dois regimes tributários (15% + adicional de 10% sobre EBIT mensal excedente a R$20.000) — Regime Tributário não altera o cálculo neste MVP, apenas permanece como metadado do projeto. Essa simplificação deve ser exposta ao usuário como nota de rodapé na Tela 4.
- **Escopo de versão:** `linha_id` (Receita, Custo e Despesas Não Operacionais) é único dentro de uma `versao_id`, não dentro do `contrato_id` mestre inteiro. Ao criar uma nova versão (Tela 7), todas as linhas desta tela são copiadas integralmente com novos `linha_id`, vinculados à nova `versao_id` — não há compartilhamento de linhas entre versões do mesmo projeto.

---

*Documento gerado a partir da Fase 1 (Análise Crítica) do Prumo Viabilidade — pronto para colar no Agente Nexus (PM) junto aos documentos anteriores já fechados.*
