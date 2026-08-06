# 01b — Motor de Cálculo & Regras Financeiras — Prumo Viabilidade

Todo o conteúdo deste documento é executado **exclusivamente no backend** (FastAPI). Nenhuma regra aqui descrita pode ser replicada como fonte de verdade no frontend — o frontend pode espelhar convenções de exibição (ex.: `—`), nunca recalcular.

---

## 1. Parâmetros Gerais da Versão

| Parâmetro | Obrigatório | Regra de nulo |
|---|---|---|
| Alíquota Tributária Efetiva (geral) | Sim | — |
| TMA | Não | Vazio → VPL exibe `—` |
| Taxa de Reinvestimento | Não | Vazio → TIRM exibe `—` |
| Taxa de Custo de Captação | Não | Vazio → Custo Financeiro = **0** (resultado válido, não `—`) |

Convenção crítica de não-uniformidade: TMA e Taxa de Reinvestimento vazias significam "não calcular" (`—`); Taxa de Custo de Captação vazia significa "calcular como zero" (resultado numérico válido). Não inverter essa convenção.

## 2. Linhas de Receita e Custo

- Total da linha = `Volumetria distribuída no mês × Valor/Custo Unitário` (fixo durante toda a janela da linha) — **nunca** input direto, nunca editável mês a mês diretamente.
- Alíquota por linha é exclusiva de Receita (Custo não tem alíquota).
- Janela da linha: `Mês de Início + Prazo` não pode exceder `Data de Início + Duração` do projeto (bloqueio de input). Única exceção: descasamento de Prazo de Pagamento no Fluxo de Caixa.
- Bloqueio duplo e independente por linha (pode coexistir, nenhum ou ambos):
  1. Vínculo com Precificação (`origem_line_id`): bloqueia edição de Total/Prazo/Valor Unitário; **não** bloqueia distribuição temporal.
  2. Override manual de distribuição: bloqueia edição de Volumetria (total) e Prazo; **não** bloqueia Valor/Custo Unitário. Liberado apenas via Reset.

## 3. Despesas Não Operacionais

- Tipo `Despesa` reduz o resultado; tipo `Recuperação` aumenta — usuário sempre digita valor positivo, o sinal é aplicado pelo motor.
- Valor mensal = `Percentual × Receita mensal da Linha de Receita de referência` (ou da Receita Bruta Total, se a referência estiver vazia).
- **Custo Financeiro** é uma linha automática não editável, projeção derivada da Taxa de Custo de Captação — nunca um input do usuário, apenas compõe o total no DRE/Fluxo de Caixa.

## 4. Cronograma Físico-Financeiro (Distribuição)

- Distribuição incide exclusivamente sobre Volumetria; Valor/Custo mensal é sempre derivado.
- Padrão: distribuição linear = `Volumetria total ÷ meses da janela da linha`.
- Override manual célula a célula, dentro da janela.
- Validação de soma obrigatória a cada edição, rodando no backend: soma das células deve bater com o total da linha. Divergência gera aviso inline, **não bloqueia** salvamento.
- Reset de distribuição: apaga todos os overrides, retorna à linear automática, libera Total/Prazo na Tela 2 — exige confirmação (ação destrutiva).

## 5. DRE (Demonstrativo de Resultado)

Estrutura de cálculo (comum a Detalhado e Resumo):

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
- **IRPJ (fórmula simplificada, única para os dois regimes tributários):**

  ```
  IRPJ(mês) = 15% × EBIT(mês)  +  10% × max(0, EBIT(mês) − R$ 20.000)
  ```

  Calculado mês a mês sobre o EBIT daquele mês (não sobre EBIT acumulado). Idêntico para Lucro Presumido e Lucro Real neste MVP.
- Margens (EBITDA, EBIT, Líquida) = valor da linha ÷ Receita Bruta do mesmo período.
- DRE Detalhado: granularidade mensal fixa; apenas EBIT Acumulado tem coluna de acumulado.
- Resumo DRE: granularidade escolhida pelo usuário (trimestral/semestral/anual); valores mensais somados por período.
- Nota obrigatória (rodapé de ambas as sub-telas):
  > "O cálculo de IRPJ apresentado utiliza uma fórmula simplificada (15% + adicional de 10% sobre o EBIT mensal excedente a R$20.000), aplicada de forma equivalente para os regimes de Lucro Presumido e Lucro Real neste MVP. Não substitui apuração fiscal formal."

## 6. Fluxo de Caixa

**Regra de deslocamento temporal:** apenas a Receita é deslocada pelo Prazo de Pagamento (30/60/90 dias). Deduções, Custos, IRPJ e Despesas Não Operacionais (exceto Custo Financeiro) permanecem em competência pura.

**Ordem de cálculo (sequencial, obrigatória — mês N depende de N-1, único cálculo da suíte com essa dependência):**

```
(+) Entrada de Caixa                                     [Receita deslocada]
(-) Deduções                                              [competência]
(-) Saída de Caixa (Custos)                               [competência]
(=) Fluxo Líquido Operacional
(-) Despesas Não Operacionais (exceto Custo Financeiro)   [competência]
(-) IRPJ                                                  [competência]
(=) Fluxo Líquido Geral
(=) Fluxo Acumulado          [PASSO 1 — soma cronológica]
---
(-) Custo Financeiro          [PASSO 2 — sobre Fluxo Acumulado do mês N-1]
(=) Saldo de Caixa Final
```

- **Passo 1:** `Fluxo Acumulado(N) = Fluxo Acumulado(N-1) + Fluxo Líquido Geral(N)`.
- **Passo 2:** `Custo Financeiro(N) = Taxa de Custo de Captação × max(0, −Fluxo Acumulado(N-1))` — zero se `N-1` for positivo/zero. Não retroalimenta o Fluxo Acumulado (passada única, sem recursão/iteração — simplificação consciente do MVP).
- **Saldo de Caixa Final** = `Fluxo Acumulado − Custo Financeiro acumulado até o mês`.

**Capital de Giro** = maior valor negativo do Fluxo Acumulado **bruto** (Passo 1, sem Custo Financeiro) ao longo de todo o projeto — número único.

**Base de VPL/TIR/TIRM:** série de **Saldo de Caixa Final** (líquido, com Custo Financeiro deduzido) — nunca o Fluxo Acumulado bruto, nunca o Lucro Líquido do DRE.

**Regra crítica de não-confusão:** Fluxo Acumulado bruto (base de Capital de Giro e Payback) e Saldo de Caixa Final líquido (base de VPL/TIR/TIRM) são séries distintas, não intercambiáveis.

## 7. Indicadores de Decisão (VPL, TIR, TIRM, Payback, Breakeven)

| Indicador | Fórmula/Base | Convenção de ausência |
|---|---|---|
| VPL | Saldo de Caixa Final descontado pela TMA | `—` se TMA vazia |
| TIR (clássica) | Saldo de Caixa Final; sempre calculada, depende só dos fluxos | `—` se sem troca de sinal na série |
| TIRM | Saldo de Caixa Final + TMA + Taxa de Reinvestimento | `—` se Taxa de Reinvestimento vazia (card sempre visível, nunca substitui pela TIR clássica) |
| Payback | Fluxo Acumulado bruto | `—` se não atingido; mês em que cruza de negativo a positivo |
| Breakeven | Fluxo Líquido Geral mensal isolado | `—` se não atingido; primeiro mês com resultado mensal positivo |
| Capital de Giro | Fluxo Acumulado bruto | Maior valor negativo acumulado (sempre calculável, não usa `—`) |

Convenção única de "não calculado"/"não atingido" em toda a suíte: **sempre `—`**, nunca zero, erro ou mensagem ad hoc.

## 8. Simulação What-If (Tela 7)

Reutiliza o motor de cálculo completo (Cronograma → DRE → Fluxo de Caixa) — não há motor simplificado paralelo. Cálculo paramétrico ao vivo sobre uma versão-base, sem gerar versão nova nem edição persistida:

- **Ajuste de Receita (%):** aplicado sobre o Valor Unitário de todas as linhas de Receita.
- **Ajuste de Custo (%):** aplicado sobre o Custo Unitário de todas as linhas de Custo.
- **Ajuste de Volumetria — Receita (%):** aplicado sobre a Volumetria total das linhas de Receita — **não afeta** Volumetria de Custo (tabelas independentes; sem correlação assumida pelo motor).

Snapshots (`versao_snapshots.resultado`) são payloads read-only, congelados no momento de "Salvar" — nunca recalculados após alteração das versões-base.

## 9. Casos de Borda do Motor de Cálculo

- **Arredondamento:** precisão decimal alta internamente (`NUMERIC(18,4)` nas colunas monetárias/volumétricas); arredondamento comercial (ABNT, half-up) a 2 casas apenas na exibição/consolidação final.
- **Valores negativos:** Volumetria e Valor/Custo Unitário bloqueiam input negativo na origem (CHECK ≥ 0 no schema). Zero é válido. Sinal de entrada/saída é decisão do motor no DRE/Fluxo de Caixa, nunca digitado pelo usuário.
- **Divisão por zero:** `duracao_meses ≥ 1` obrigatória (bloqueio de input, CHECK no schema). Indicadores com denominador zero exibem `—`, nunca erro/infinito/`NaN`.

## 10. Cenários de Teste para Regressão

| # | Cenário | Entrada | Saída Esperada |
|---|---|---|---|
| T1 | Alíquotas distintas por linha de Receita | 2 linhas de Receita com alíquotas 6% e 12% | Deduções = soma das deduções individuais, **não** `Receita Total × alíquota única` |
| T2 | TMA vazia | `parametros_versao.tma = NULL` | VPL exibe `—`; TIR e demais indicadores seguem calculados normalmente |
| T3 | Taxa de Custo de Captação vazia | `parametros_versao.taxa_custo_captacao = NULL` | Custo Financeiro = `0` em todos os meses (nunca `—`) |
| T4 | Prazo de Pagamento 60 dias | Receita reconhecida no mês 5 do DRE | Entrada de Caixa aparece no mês 7 do Fluxo de Caixa; Custos/IRPJ/Despesas seguem no mês 5 |
| T5 | Fluxo Acumulado negativo no mês N-1 | Fluxo Acumulado(4) = −10.000, Taxa de Custo de Captação = 2%/mês | Custo Financeiro(5) = 200; Custo Financeiro(5) não altera Fluxo Acumulado(5) |
| T6 | IRPJ com EBIT acima do limiar | EBIT(mês) = R$ 30.000 | IRPJ = `15% × 30.000 + 10% × (30.000 − 20.000)` = `4.500 + 1.000` = `5.500` |
| T7 | Capital de Giro vs. Saldo de Caixa Final | Série onde Fluxo Acumulado bruto e Saldo de Caixa Final líquido divergem (há Custo Financeiro relevante) | Capital de Giro usa a série bruta; VPL/TIR/TIRM usam exclusivamente a série líquida — confirmar que motor não mistura as duas |
| T8 | Divisão por zero em indicador | Projeto sem troca de sinal na série de caixa | TIR exibe `—`, sem erro/exceção |
| T9 | Reset de distribuição | Linha com overrides manuais → executa Reset | Todos os overrides apagados; volta à distribuição linear; Total/Prazo voltam editáveis na Tela 2 |
| T10 | Simulação what-if de Volumetria de Receita | Ajuste de Volumetria — Receita = +15% | Volumetria de Custo permanece inalterada; toda a cadeia (Cronograma→DRE→Fluxo de Caixa) recalculada só para Receita |
