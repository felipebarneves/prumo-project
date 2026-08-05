# Especificação de Tela — Handoff para Agente Nexus (PM)
### Módulo: Prumo Viabilidade | Tela 5/10: Fluxo de Caixa

> Serve de input para `01b-business-rules-engine.md` e `03-frontend-ux.md` do módulo Viabilidade. Pressupõe as Telas 2, 3 e 4 já especificadas. Diferente das telas anteriores, esta é a primeira em que a ordem de cálculo importa — o saldo de um mês depende do saldo do mês anterior, e a mecânica de Custo Financeiro exige uma sequência específica para evitar recursão.

---

## 1. Objetivo

Tela que converte o resultado em regime de competência (DRE, Tela 4) para regime de caixa — reconhecendo o descasamento de recebimento de Receita conforme o Prazo de Pagamento do contrato (Tela 1), e calculando o Saldo de Caixa Acumulado do projeto mês a mês. É desta tela que nascem Capital de Giro, e a base de desconto de VPL/TIR/TIRM.

---

## 2. Regra de Deslocamento Temporal (Regime de Caixa)

**Decisão de escopo do MVP:** apenas a **Receita** é deslocada no tempo — Custo permanece em regime de competência puro no Fluxo de Caixa (pago no mesmo mês em que ocorre, sem simular prazo de pagamento a fornecedores). Extensível em v2 se necessário.

- **Entrada de Caixa (Receita):** o valor de Receita Bruta de cada mês (Tela 4) é deslocado para o mês de efetivo recebimento, conforme o Prazo de Pagamento do projeto (30/60/90 dias, Tela 1). Ex: receita gerada no mês 5 com prazo de 60 dias entra no caixa no mês 7.
- **Deduções (impostos sobre Receita):** permanecem na competência original do DRE — **não** se deslocam junto com a Receita. Refletem o mesmo mês em que aparecem na Tela 4.
- **Saída de Caixa (Custos Operacionais):** competência pura, mesmo mês do DRE — sem deslocamento.
- **IRPJ:** competência pura, mesmo mês e valor do DRE — sem deslocamento de prazo de recolhimento.
- **Despesas Não Operacionais (exceto Custo Financeiro):** competência pura, mesmo mês do DRE — mesma lógica de Custos.

---

## 3. Estrutura de Cálculo e Ordem de Execução

A ordem abaixo não é apenas apresentação — é a sequência de cálculo real, necessária para resolver a dependência entre Fluxo Acumulado e Custo Financeiro sem recursão.

```
(+) Entrada de Caixa                    [Receita deslocada por Prazo de Pagamento]
(-) Deduções (Impostos sobre Receita)   [competência original, sem deslocamento]
(-) Saída de Caixa (Custos Operacionais)[competência]
(=) Fluxo Líquido Operacional
(-) Despesas Não Operacionais           [exceto Custo Financeiro — competência]
(-) IRPJ                                [competência]
(=) Fluxo Líquido Geral
(=) Fluxo Acumulado                     [soma de Fluxo Líquido Geral, mês a mês, PASSO 1]
---
(-) Custo Financeiro                    [PASSO 2 — calculado após o Fluxo Acumulado acima existir]
(=) Saldo de Caixa Final
```

**Passo 1 — Fluxo Acumulado (bruto, sem Custo Financeiro):** soma cronológica do Fluxo Líquido Geral mês a mês. Este é o saldo que determina se o projeto está com caixa negativo em cada período.

**Passo 2 — Custo Financeiro (única fonte de recursão controlada):**
- Custo Financeiro do mês N é calculado aplicando a Taxa de Custo de Captação (Tela 2) sobre o saldo negativo do **Fluxo Acumulado do mês N-1** (não do mês corrente, e não do Saldo de Caixa Final).
- Se o Fluxo Acumulado do mês N-1 for positivo ou zero, Custo Financeiro do mês N é zero.
- Custo Financeiro **não retroalimenta** o Fluxo Acumulado — ele é subtraído apenas na linha final (Saldo de Caixa Final), não é somado de volta ao Passo 1. Isso é o que evita a recursão/iteração: o cálculo roda em passada única, aceitando a imprecisão conceitual como simplificação consciente do MVP (reavaliável em v2 com modelo iterativo, se necessário).

**Saldo de Caixa Final** = Fluxo Acumulado (Passo 1) − Custo Financeiro acumulado até o mês (Passo 2).

---

## 4. Capital de Giro

- **Definição (MVP):** maior valor negativo do **Fluxo Acumulado** (Passo 1, antes do Custo Financeiro) ao longo de toda a duração do projeto — um número único, não uma série mensal.
- Usa o saldo bruto (sem Custo Financeiro) para evitar circularidade — o Custo Financeiro em si é calculado a partir desse mesmo saldo, então usar o saldo já líquido de Custo Financeiro para definir Capital de Giro criaria uma segunda dependência circular.
- Exibido nesta tela como indicador de referência; a exibição consolidada (junto aos demais KPIs) pertence ao Dashboard (Tela 6).

---

## 5. Base de Desconto para VPL / TIR / TIRM

**Decisão de escopo:** VPL, TIR e TIRM usam bases diferentes de Capital de Giro — respondem perguntas diferentes.

- **VPL, TIR, TIRM** descontam/avaliam o **Saldo de Caixa Final mês a mês** (líquido, já com Custo Financeiro deduzido) — não o Fluxo Acumulado bruto, e não o Lucro Líquido do DRE (regime de competência). Justificativa: Custo Financeiro é uma saída de caixa real; ignorá-la no fluxo descontado tornaria VPL/TIR artificialmente otimistas.
- **Capital de Giro** usa o Fluxo Acumulado bruto (seção 4) — respondem a "qual o pico de necessidade de caixa a financiar", que precisa ser calculado antes do próprio custo de financiar essa necessidade.
- Fórmulas de VPL/TIR/TIRM em si (aplicação de TMA, Taxa de Reinvestimento) já fechadas na Tela 2 — esta seção define apenas **qual série de fluxo de caixa** alimenta essas fórmulas.

---

## 6. Estrutura de Linhas da Tela (Layout)

Uma única tabela, granularidade mensal fixa (mesmo eixo temporal do Cronograma e do DRE Detalhado):

| Item | Observação |
|---|---|
| Entrada de Caixa | Receita deslocada por Prazo de Pagamento |
| Deduções | Competência original — não deslocada |
| Saída de Caixa | Custos Operacionais, competência |
| Fluxo Líquido Operacional | Subtotal |
| Despesas Não Operacionais | Exceto Custo Financeiro, competência |
| IRPJ | Competência |
| Fluxo Líquido Geral | Subtotal |
| Fluxo Acumulado | Soma cronológica do Fluxo Líquido Geral — base do Capital de Giro |
| Custo Financeiro | Calculado sobre o Fluxo Acumulado do mês anterior (seção 3, Passo 2) |
| Saldo de Caixa Final | Fluxo Acumulado − Custo Financeiro acumulado — base de VPL/TIR/TIRM |

**Nota de simplificação:** eliminada a duplicação visual de linha (item + sublinha idêntica) presente no layout de referência original — cada item aparece uma única vez, sem repetição.

---

## 7. Fora de Escopo desta Tela

- **Qualquer input de dado:** 100% leitura/agregação, assim como o DRE.
- **Deslocamento temporal de Custo, IRPJ ou Despesas Não Operacionais:** competência pura para todos exceto Receita, no MVP.
- **Modelo iterativo de Custo Financeiro:** passada única aceita como simplificação consciente (seção 3).
- **Exibição consolidada de Capital de Giro, VPL, TIR, TIRM, Breakeven, Payback:** concentrada no Dashboard (Tela 6) — resumo executivo.

---

## 8. Decisões Técnicas/Fronteiras (input para Nexus)

- Esta tela não persiste dado novo — view computada sobre Receita, Custo, Despesas Não Operacionais (Tela 2/3) e o DRE (Tela 4). Nenhuma tabela de schema adicional além do necessário para armazenar (ou memoizar, se performance exigir) o Fluxo Acumulado mês a mês, já que ele é a única série com dependência sequencial (mês N depende de N-1) entre todas as telas construídas até aqui — as demais telas calculam cada mês de forma independente.
- Custo Financeiro do mês N depende do Fluxo Acumulado do mês N-1 — implementação deve garantir cálculo sequencial (mês a mês, em ordem), não paralelizável como as demais projeções desta suíte.
- Capital de Giro e a base de VPL/TIR/TIRM usam deliberadamente séries diferentes (Fluxo Acumulado bruto vs. Saldo de Caixa Final líquido) — não são a mesma variável reutilizada; o `01b-business-rules-engine.md` deve tratá-las como duas séries distintas, calculadas uma a partir da outra em sequência, nunca a mesma referência.
- Receita é a única linha com deslocamento temporal no MVP — Custo, IRPJ e Despesas Não Operacionais (exceto Custo Financeiro) permanecem em competência pura. Extensão para descasamento de Custo é backlog de v2, não requer alteração de schema agora, apenas de lógica de cálculo futura.
- **Escopo de versão:** o Fluxo Acumulado (série sequencial, mês N depende de mês N-1) é calculado inteiramente dentro do escopo de uma única `versao_id` — o saldo acumulado de uma versão nunca herda ou soma valores de outra versão do mesmo projeto, mesmo quando uma é cópia da outra. Cada versão recalcula sua própria série do zero a partir dos seus próprios dados.
- **Seletor de Versão:** esta tela exibe o componente global de troca de versão no cabeçalho, especificado na Tela 2 (seção 2b). Como esta tela é 100% leitura, a troca de versão aqui é livre, sem confirmação de alterações não salvas.

---

*Documento gerado a partir da Fase 1 (Análise Crítica) do Prumo Viabilidade — pronto para colar no Agente Nexus (PM) junto aos documentos anteriores já fechados.*
