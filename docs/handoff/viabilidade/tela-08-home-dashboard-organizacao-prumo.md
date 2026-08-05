# Especificação de Tela — Handoff para Agente Nexus (PM)
### Módulo: Prumo Viabilidade | Tela 8/10: Home / Dashboard da Organização

> Serve de input para `01b-business-rules-engine.md` e `03-frontend-ux.md` do módulo Viabilidade. Pressupõe as Telas 1 a 7 já especificadas. Diferente da Tela 6 (resumo executivo de **um** projeto), esta tela agrega dados de **todos** os projetos da organização dentro do módulo Viabilidade.

---

## 1. Objetivo

Tela de entrada da organização no módulo Viabilidade: resumo executivo agregado entre todos os projetos, mais os indicadores de uso de capacidade do plano contratado (Contratos Ativos). Sem eixo temporal — números consolidados, sem gráfico por ano.

---

## 2. Regra de Agregação entre Projetos

- **Escopo do MVP: restrito ao módulo Viabilidade.** Mesmo que a organização tenha Precificação e/ou Gestão contratados, esta tela não mistura dados de outros módulos — extensível em v2, quando houver clareza sobre como normalizar KPIs entre módulos.
- **Versão usada por projeto:** a versão mais recentemente criada de cada projeto (mesma regra de "abre por padrão" já fechada na Tela 7) — não existe conceito de "versão oficial" separado, então a agregação usa a mesma regra automática de toda a suíte.
- **Projetos arquivados não entram na agregação por padrão.** Sem filtro para incluí-los nesta tela (diferente da listagem da Tela 1, que tem toggle "Mostrar arquivados") — se o usuário precisa desse número, deve ir à Tela 1 e à Tela 6 de cada projeto arquivado individualmente.

---

## 3. Cards de KPI

| Card | Cálculo | Visibilidade |
|---|---|---|
| Receita Bruta Total | Soma da Receita Bruta Total (Tela 6) da versão mais recente de cada projeto não-arquivado | Owner, Executor, Viewer |
| EBITDA Total | Soma do EBITDA Total (Tela 6) da versão mais recente de cada projeto não-arquivado | Owner, Executor, Viewer |
| Margem EBITDA (média ponderada) | EBITDA Total ÷ Receita Bruta Total (agregados acima) — não é média simples das margens individuais dos projetos | Owner, Executor, Viewer |
| Contratos Ativos | Contador já existente (Tela 1 / estrutura comercial) — "X de Y" conforme limite do tier contratado | Owner, Executor, Viewer |

**Nota:** VPL, TIR, TIRM, Payback, Breakeven e Capital de Giro **não são agregados** nesta tela — são indicadores por projeto, calculados sobre janelas temporais distintas entre projetos (datas de início e durações diferentes); somar ou fazer média desses números entre projetos não produz um valor com significado financeiro coerente. Permanecem exclusivos da Tela 6 de cada projeto.

---

## 4. Fora de Escopo desta Tela

- **Gráficos com eixo temporal (por ano civil):** descartado para o MVP — janelas de projeto desalinhadas (cada projeto com sua própria Data de Início e Duração) tornariam a normalização complexa sem ganho claro de decisão nesta etapa. Candidato a v2.
- **Agregação entre módulos** (Viabilidade + Precificação + Gestão): fora do MVP, restrito a Viabilidade.
- **Inclusão de projetos arquivados na agregação:** fora do padrão desta tela — ver seção 2.
- **VPL, TIR, TIRM, Payback, Breakeven, Capital de Giro agregados:** não fazem sentido matemático agregados entre projetos — ver seção 3.
- **Gestão de usuários (contagem, convite, remoção):** pertence à Tela 9 (Configurações), não a esta.
- **Listagem detalhada de projetos:** já existe na Tela 1 — esta tela não duplica essa funcionalidade, apenas consolida números agregados.

---

## 5. Decisões Técnicas/Fronteiras (input para Nexus)

- Esta tela não persiste dado novo — agregação computada em tempo de leitura sobre a versão mais recente de cada projeto não-arquivado da organização, já calculada individualmente na Tela 6 de cada projeto.
- Regra de seleção de versão para agregação (mais recente por projeto) é a mesma regra de "abre por padrão" já fechada na Tela 7 — não introduz uma segunda convenção de versão.
- Contador de Contratos Ativos reutiliza a mesma lógica já especificada na Tela 1 (seção 8) — este card não recalcula, apenas exibe o mesmo valor em um contexto executivo.
- Margem EBITDA agregada deve ser calculada como razão dos totais agregados (EBITDA Total ÷ Receita Bruta Total), nunca como média aritmética simples das margens individuais dos projetos — evita distorção quando projetos têm portes muito diferentes.
- Projetos sem nenhuma versão com dados suficientes para gerar KPIs de Tela 6 (ex: projeto recém-criado, ainda sem parametrização) devem ser excluídos do somatório sem gerar erro — tratamento de ausência de dado, não falha de cálculo.

---

*Documento gerado a partir da Fase 1 (Análise Crítica) do Prumo Viabilidade — pronto para colar no Agente Nexus (PM) junto aos documentos anteriores já fechados.*
