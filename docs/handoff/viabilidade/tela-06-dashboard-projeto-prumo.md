# Especificação de Tela — Handoff para Agente Nexus (PM)
### Módulo: Prumo Viabilidade | Tela 6/10: Dashboard Inicial do Projeto

> Serve de input para `01b-business-rules-engine.md` e `03-frontend-ux.md` do módulo Viabilidade. Pressupõe as Telas 2 a 5 já especificadas. Esta é a tela de resumo executivo do projeto — concentra todos os KPIs derivados que, por decisão de escopo já registrada nas telas anteriores, não vivem no DRE nem no Fluxo de Caixa.

---

## 1. Objetivo

Resumo executivo de um projeto específico (não da organização — isso é a Tela 8, Home/Dashboard da organização). Reúne os KPIs de viabilidade financeira num único lugar para apoiar a decisão de "este projeto vale a pena", com visão gráfica complementar de DRE e Fluxo de Caixa por ano. **Esta tela sempre exibe os dados de uma única versão por vez** — a versão atualmente aberta do projeto (por padrão, a mais recente, conforme já fechado na Tela 7). Comparação entre versões não acontece aqui; pertence exclusivamente à Tela 7.

---

## 2. Cards de KPI

Todos os valores são 100% derivados — nenhum é input desta tela. Bases de cálculo já fechadas nas telas anteriores; aqui apenas se consolidam para exibição.

| Card | Fonte / Base | Observação |
|---|---|---|
| Receita Bruta Total | Tela 4 | Soma do projeto inteiro |
| EBITDA Total | Tela 4 | Soma do projeto inteiro |
| Margem EBITDA | Tela 4 | EBITDA Total / Receita Bruta Total |
| Fluxo Líquido (Total) | Tela 5 — Saldo de Caixa Final | Soma do projeto inteiro, base líquida (já com Custo Financeiro deduzido) |
| VPL | Tela 5 — Saldo de Caixa Final mensal, descontado pela TMA | Exibe `—` se TMA não preenchida (Tela 2) |
| TIR | Tela 5 — Saldo de Caixa Final mensal | Sempre calculada; exibe `—` se o fluxo não tiver troca de sinal |
| TIRM | Tela 5 — Saldo de Caixa Final mensal, com TMA + Taxa de Reinvestimento | Card sempre visível; exibe o valor calculado se Taxa de Reinvestimento estiver preenchida (Tela 2), caso contrário exibe `—` — mesma convenção de "não calculado" usada nos demais cards (VPL, Payback, Breakeven) |
| Payback | Tela 5 — Fluxo Acumulado bruto | Mês em que o Fluxo Acumulado bruto cruza de negativo para positivo. `—` se não atingido no período do projeto |
| Breakeven | Tela 5 — Fluxo Líquido Geral mensal (isolado, não acumulado) | Primeiro mês em que o resultado mensal (não acumulado) é positivo. `—` se não atingido |
| Capital de Giro | Tela 5 — Fluxo Acumulado bruto | Maior valor negativo do Fluxo Acumulado bruto ao longo do projeto — pico de necessidade de caixa |
| Custo Financeiro (Total) | Tela 5 | Soma do Custo Financeiro do projeto inteiro — exibido como transparência do valor absorvido, sem toggle de ativação/desativação (fora de escopo do MVP) |

**Layout de referência:** grade de cards no topo da tela, formato compacto (rótulo + valor + eventual métrica secundária, ex: Margem sob EBITDA Total, "Op. ponto de equilíbrio" sob Breakeven) — conforme modelo de referência já validado.

---

## 3. Gráfico 1 — DRE por Ano

- Gráfico de barras agrupadas, uma coluna de grupo por ano do projeto.
- Séries: Receita Líquida, Custos, EBITDA — mesma fonte de dado do Resumo DRE (Tela 4), agregação anual.
- **Interação (não bloqueante para o MVP):** clicar no ano detalha a visão mensal daquele ano (reaproveitando os dados já existentes do DRE Detalhado, Tela 4). Se o esforço de implementação não couber no MVP, a visão estática anual sem drill-down é aceitável — registrar como candidato a refinamento de v1.x, não como bloqueador de lançamento.

---

## 4. Gráfico 2 — Fluxo de Caixa por Ano

- Gráfico combinado: barras (Fluxo Anual, agregado por ano a partir do Fluxo Líquido Geral mensal da Tela 5) sobrepostas ou lado a lado com uma **linha de Caixa Acumulado** (Fluxo Acumulado bruto, mesma base do Capital de Giro e do Payback) — combinando a visão de barras do modelo de referência (print "Fluxo de Caixa por Ano") com a curva de acumulado do modelo de referência (print "Caixa Acumulado (Anual)").
- Mesma interação de clique-para-detalhar do Gráfico 1, mesma nota de não-bloqueio para o MVP.
- Esta é a visualização que naturalmente evidencia Capital de Giro (o vale mais profundo da curva) e Payback (onde a curva cruza zero) no mesmo lugar, sem card adicional.

---

## 5. Fora de Escopo desta Tela

- **Toggle "Considerar Custo Financeiro" em variações de KPI:** avaliado e descartado para o MVP. A intenção do usuário (entender o efeito do custo de captação) já é resolvida pela existência do input de Taxa de Custo de Captação na Tela 2 e pela exibição do card "Custo Financeiro (Total)" nesta tela — não há necessidade de estado alternável de exibição.
- **Qualquer input de dado:** 100% leitura/agregação.
- **Dashboard da organização** (contratos ativos, receita bruta agregada entre projetos): Tela 8, escopo distinto.
- **Exportação e ações de "Salvar"** vistas no modelo de referência: não especificadas nesta rodada — a especificar quando o fluxo de exportação for tratado (provavelmente transversal a várias telas, não exclusivo desta).
- **Comparação entre versões:** não acontece nesta tela — pertence exclusivamente à Tela 7 (Comparar Versões).

---

## 6. Decisões Técnicas/Fronteiras (input para Nexus)

- Esta tela não persiste dado novo — todos os cards e gráficos são agregações computadas sobre dados já existentes nas Telas 2 a 5. Não requer schema adicional além do que já foi especificado.
- Payback e Capital de Giro compartilham a mesma base (Fluxo Acumulado bruto, Tela 5) — não confundir com a base de VPL/TIR/TIRM (Saldo de Caixa Final líquido). Ambas as bases já existem como séries calculadas na Tela 5; esta tela apenas as referencia, não recalcula.
- TIRM é sempre exibida como card — não é ocultada condicionalmente. Ausência de Taxa de Reinvestimento não é um erro de cálculo, é ausência de input opcional (Tela 2); o `03-frontend-ux.md` deve tratar isso como estado normal de UI (`—`), não como estado de erro nem como card oculto.
- Convenção de "não atingido" (Breakeven, Payback, VPL/TIR/TIRM quando aplicável) usa `—`, consistente com a convenção já fechada nas Telas 2, 4 e 5. Mensagens diferenciadas (ex: "Não atingido no período do projeto") ficam como candidato de refinamento de v2, não bloqueiam o MVP.
- Gráficos consomem os mesmos dados de Tela 4 (DRE) e Tela 5 (Fluxo de Caixa) já agregados por ano — não introduzem nova lógica de cálculo, apenas nova camada de agregação temporal (anual) sobre dados mensais já existentes.
- **Seletor de Versão:** esta tela exibe o componente global de troca de versão no cabeçalho, especificado na Tela 2 (seção 2b) — mesmo componente presente nas Telas 3, 4 e 5. Como esta tela é 100% leitura, a troca de versão aqui é livre, sem confirmação de alterações não salvas.

---

*Documento gerado a partir da Fase 1 (Análise Crítica) do Prumo Viabilidade — pronto para colar no Agente Nexus (PM) junto aos documentos anteriores já fechados.*
