# Especificação de Tela — Handoff para Agente Nexus (PM)
### Módulo: Prumo Viabilidade | Tela 4/10: DRE Detalhado + Resumo DRE

> Serve de input para `01b-business-rules-engine.md` e `03-frontend-ux.md` do módulo Viabilidade. Pressupõe as Telas 2 e 3 já especificadas — linhas de Receita, Custo e Despesas Não Operacionais existem com seus totais e distribuições mensais já calculados.

---

## 1. Objetivo

Tela que exibe o resultado financeiro do projeto em regime de competência puro — sem qualquer ajuste de Prazo de Pagamento (esse descasamento é exclusivo do Fluxo de Caixa, Tela 5). É uma visão derivada, sem input de dados: consome integralmente o que já foi parametrizado nas Telas 2 e 3. Duas sub-telas com a mesma fonte de dado, granularidades diferentes: **DRE Detalhado** (mensal fixo) e **Resumo DRE** (granularidade escolhida pelo usuário).

---

## 2. Estrutura de Cálculo (comum às duas sub-telas)

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

- **Receita Operacional Bruta:** soma de todas as linhas da Tabela de Receita (Tela 2), com a Volumetria distribuída da Tela 3.
- **Deduções:** soma das deduções por linha de Receita, cada uma usando sua própria alíquota (específica da linha, ou a Alíquota Tributária Efetiva geral quando a linha não tem alíquota própria — Tela 2, seção 4). É a soma das deduções individuais por linha, nunca (Receita Bruta total × alíquota geral) — linhas com alíquotas diferentes não podem ser agregadas antes de aplicar a alíquota.
- **Custos Operacionais:** soma de todas as linhas da Tabela de Custo (Tela 2), com a Volumetria de Custo distribuída da Tela 3.
- **Despesas Não Operacionais:** soma das linhas derivadas da Tela 2 (seção 5b) — cada uma calculada mês a mês como Percentual × Receita mensal da linha de referência (ou Receita Bruta Total, se sem referência) — mais a linha automática de Custo Financeiro (derivada da Taxa de Custo de Captação). Linhas do tipo `Recuperação` somam; do tipo `Despesa` subtraem.
- **IRPJ:** calculado automaticamente sobre o EBIT do mês — 15% + adicional de 10% sobre o que exceder R$20.000/mês. Fórmula única, independente do Regime Tributário do projeto (ver nota de rodapé, seção 5).

**Margens exibidas junto a cada subtotal relevante:** Margem EBITDA, Margem EBIT, Margem Líquida (cada uma como % sobre a Receita Bruta do mesmo período).

---

## 3. DRE Detalhado

- **Granularidade fixa:** mensal, uma coluna por mês, cobrindo toda a duração do projeto (mesmo eixo temporal do Cronograma, Tela 3).
- **Colunas:** Item (linha da DRE) | Total do projeto | Mês 01 | Mês 02 | ... | Mês N.
- **Linha acumulada:** apenas **EBIT Acumulado** tem coluna de acumulado no MVP — as demais linhas (Receita, Custos, Lucro Líquido) exibem apenas o valor do mês corrente, sem acumulado. Escopo restrito deliberadamente para o MVP; extensível em v2 se necessário.
- Estrutura de linhas segue a seção 2, sem omissões — é a visão completa, mês a mês.

---

## 4. Resumo DRE

- **Granularidade escolhida pelo usuário:** trimestral, semestral ou anual — seletor na própria tela. Não existe granularidade mensal aqui (essa é exclusiva do Detalhado).
- **Colunas:** Total do projeto | períodos consolidados conforme granularidade escolhida (ex: se anual — uma coluna por ano do projeto).
- Mesma estrutura de linhas da seção 2 — os valores mensais do Detalhado são somados dentro de cada período consolidado antes de exibir.
- Cabeçalho da tela exibe metadados do projeto: Início do Projeto, Fim do Contrato, Prazo (mesma lógica do layout de referência já validado).
- **Fora desta tela:** Fluxo de Caixa, Capital de Giro, VPL, TIR/TIRM, Breakeven, Payback — todos esses indicadores ficam concentrados no Dashboard do projeto (Tela 6), que atua como resumo executivo consolidado. O Resumo DRE não duplica essa exibição.

---

## 5. Nota de Rodapé Obrigatória (IRPJ)

Ambas as sub-telas devem exibir, ao pé da tabela, uma nota explícita ao cliente sobre a simplificação do cálculo de IRPJ — texto sugerido:

> *"O cálculo de IRPJ apresentado utiliza uma fórmula simplificada (15% + adicional de 10% sobre o EBIT mensal excedente a R$20.000), aplicada de forma equivalente para os regimes de Lucro Presumido e Lucro Real neste MVP. Não substitui apuração fiscal formal."*

---

## 6. Fora de Escopo desta Tela

- **Qualquer input de dado:** esta tela é 100% leitura/agregação — não há campo editável aqui. Toda a parametrização acontece nas Telas 2 e 3.
- **Ajuste por Prazo de Pagamento:** regime de competência puro — o descasamento de recebimento é tratado exclusivamente no Fluxo de Caixa (Tela 5).
- **VPL, TIR, TIRM, Capital de Giro, Breakeven, Payback:** ficam no Dashboard (Tela 6) — ver seção 4.
- **Diferenciação de fórmula de IRPJ por regime tributário:** decisão consciente de simplificação do MVP (seção 5).

---

## 7. Decisões Técnicas/Fronteiras (input para Nexus)

- Esta tela não persiste nenhum dado novo — é uma agregação/view computada a partir de Receita, Custo e Despesas Não Operacionais (Tela 2) já distribuídos mensalmente (Tela 3). Nenhuma tabela de schema adicional é necessária para o DRE em si.
- Deduções sobre Receita devem ser calculadas por linha antes de agregar — implementar como soma de (Receita da linha × sua própria alíquota), nunca como (Receita total agregada × alíquota geral), para preservar corretamente os casos de alíquota específica por linha.
- IRPJ é calculado mês a mês sobre o EBIT daquele mês (não sobre o EBIT acumulado) — fórmula fixa e única, sem branch condicional por Regime Tributário, mas com nota de rodapé obrigatória em ambas as sub-telas.
- DRE Detalhado e Resumo DRE compartilham a mesma lógica de cálculo do `01b-business-rules-engine.md` — a única diferença entre as duas sub-telas é a granularidade de agregação temporal aplicada na camada de apresentação, não uma fórmula distinta.
- Granularidade do Resumo DRE (trimestral/semestral/anual) é escolha de UI persistida por sessão ou preferência do usuário — não é um dado do projeto, não requer campo no schema do `contrato_id` mestre.
- **Escopo de versão:** DRE Detalhado e Resumo DRE são sempre calculados dentro do escopo de uma única `versao_id` — não há agregação entre versões diferentes do mesmo projeto nesta tela. A comparação de resultados entre versões distintas pertence exclusivamente à Tela 7 (Comparar Versões).
- **Seletor de Versão:** esta tela exibe o componente global de troca de versão no cabeçalho, especificado na Tela 2 (seção 2b). Como esta tela é 100% leitura, a troca de versão aqui é livre, sem confirmação de alterações não salvas.

---

*Documento gerado a partir da Fase 1 (Análise Crítica) do Prumo Viabilidade — pronto para colar no Agente Nexus (PM) junto aos documentos anteriores já fechados.*
