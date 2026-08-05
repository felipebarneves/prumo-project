# Índice de Handoff — Prumo Viabilidade (Fase 1 Completa)
### Guia de leitura para o Agente Nexus (PM)

> Este documento não introduz nenhuma decisão nova — é um mapa de navegação entre os 12 documentos produzidos na Fase 1 (Análise Crítica), com as dependências cruzadas entre eles. Leia este índice primeiro; ele indica a ordem recomendada de leitura e sinaliza onde uma decisão tomada num documento afeta outro.

---

## Ordem de Leitura Recomendada

### 1. Documentos de Fundação (ler primeiro, sempre)

| Documento | O que resolve |
|---|---|
| `minuta-requisitos-estrutura-comercial-prumo.md` | Estrutura de planos (4 tiers), capacidade por tier (usuários/contratos ativos), regra de downgrade, gatekeeping via `subscription_status` do Stripe, arquivamento. Fonte oficial de tudo que é comercial — nenhuma outra tela redefine essas regras, apenas as referencia. |
| `resumo-prumo-viabilidade-construcao-telas.md` | Decisões gerais fechadas na Fase 1 antes da construção tela a tela: regras fiscais (regime, alíquota manual), modelo de versionamento (visão inicial, refinada depois na Tela 7), integração entre módulos (Precificação→Viabilidade→Gestão, importação por cópia), modelo de conta/organização/papéis, arquitetura (monolito, feature-flag). |

### 2. As 10 Telas (ordem de construção = ordem de dependência estrutural)

| # | Documento | O que resolve |
|---|---|---|
| 1 | `tela-01-cadastro-consulta-projetos-prumo.md` | Porta de entrada do módulo. Cadastro do `contrato_id` mestre, vínculo entre módulos, arquivamento, matriz de permissões, comportamento de limite de plano (softblock). |
| 2 | `tela-02-parametros-input-prumo.md` | Tela mais estrutural do módulo. Parâmetros gerais (alíquota, TMA, Taxa de Reinvestimento, Taxa de Custo de Captação), tabelas de Receita e Custo (Volumetria + Unitário + Unidade de Medida), Despesas Não Operacionais (percentual sobre receita de referência). **Também define o Seletor de Versão (seção 2b), componente global referenciado nas Telas 3, 4, 5 e 6.** |
| 3 | `tela-03-cronograma-fisico-financeiro-prumo.md` | Distribuição temporal da Volumetria (linear/manual) sobre os totais definidos na Tela 2. Reset de override, validação de soma, células fora da janela da linha. |
| 4 | `tela-04-dre-detalhado-resumo-prumo.md` | DRE em regime de competência puro, calculado a partir das Telas 2 e 3. IRPJ simplificado (fórmula única, independente de regime tributário — nota de rodapé obrigatória). Duas sub-visões: Detalhado (mensal fixo) e Resumo (granularidade escolhida pelo usuário). |
| 5 | `tela-05-fluxo-de-caixa-prumo.md` | Conversão de competência para caixa — Receita deslocada por Prazo de Pagamento (Tela 1), demais itens em competência. Mecânica de Custo Financeiro em passada única (resolve a dependência circular com o próprio Fluxo Acumulado). Origem de Capital de Giro e da base de VPL/TIR/TIRM. |
| 6 | `tela-06-dashboard-projeto-prumo.md` | Resumo executivo de **um** projeto — todos os KPIs derivados (VPL, TIR, TIRM, Payback, Breakeven, Capital de Giro) que não vivem no DRE nem no Fluxo de Caixa. Gráficos de DRE e Fluxo de Caixa por ano. |
| 7 | `tela-07-cenarios-whatif-versoes-prumo.md` | Modelo formal de versionamento (Projeto → Versões, cópia completa). Quatro sub-abas: Comparar Versões, Simulação What-If (3 diais percentuais, motor completo reutilizado), Histórico de Versões (lista, ações de abrir/renomear/duplicar/excluir), Salvos (snapshots read-only). **Contém a nota retroativa mais importante do conjunto: `versao_id` precisa ser parte da chave em todo o schema das Telas 2 a 6.** |
| 8 | `tela-08-home-dashboard-organizacao-prumo.md` | Agregação entre todos os projetos da organização (não só um) — restrita ao módulo Viabilidade no MVP, usando sempre a versão mais recente de cada projeto não-arquivado. |
| 9 | `tela-09-configuracoes-prumo.md` | Perfil de organização/usuário, tema claro/escuro (exceção deliberada ao Dark First do playbook), Gestão de Usuários (Owner-only, convite/papel/remoção), Plano Atual (Owner-only, view-only). |
| 10 | `tela-10-login-esqueci-senha-prumo.md` | Login, recuperação de senha, aceite de convite (variação desta tela, gatilho que efetiva a contagem de uso de Usuários do plano). Sem self-signup nem login social no MVP. |

---

## Dependências Cruzadas Mais Importantes (não óbvias a partir de uma leitura isolada)

Estas são as amarrações entre documentos que mais provavelmente seriam perdidas se cada arquivo fosse lido de forma independente:

1. **`versao_id` é transversal a quase tudo.** Introduzido formalmente na Tela 7, mas afeta retroativamente o schema das Telas 2, 3, 4, 5 e 6 (cada uma tem uma nota técnica própria confirmando o escopo). Ao escrever `01-database-schema.md`, tratar isso como requisito desde o desenho inicial das tabelas, não como migração posterior.

2. **Seletor de Versão é um único componente, especificado uma vez (Tela 2, seção 2b), usado em cinco telas (2, 3, 4, 5, 6).** Não reespecificar do zero em cada tela — as Telas 3-6 apenas referenciam a Tela 2 para a mecânica completa (incluindo a proteção obrigatória de alterações não salvas nas Telas 2 e 3).

3. **Duas bases de cálculo distintas nascem na Tela 5 e se propagam:** Fluxo Acumulado bruto (base de Capital de Giro e Payback) vs. Saldo de Caixa Final líquido, já com Custo Financeiro deduzido (base de VPL/TIR/TIRM). Não são intercambiáveis — confundir as duas é o erro mais fácil de cometer ao implementar o `01b-business-rules-engine.md`.

4. **Vínculo com Precificação (`origem_line_id`) tem escopo de bloqueio diferente em cada tela:** bloqueia edição de total/prazo/unitário na Tela 2, mas **não** bloqueia distribuição temporal na Tela 3. E o vínculo em si é por versão (Tela 7), não por projeto — uma versão pode estar vinculada enquanto outra do mesmo projeto não está.

5. **Contagem de uso de plano (Usuários e Contratos Ativos) tem gatilhos específicos, não intuitivos:** convite de usuário só conta após aceite (Tela 9 + Tela 10, não no momento do envio); contrato arquivado sai da contagem mas mantém leitura (Tela 1); a agregação da Tela 8 usa sempre a versão mais recente de cada projeto, nunca uma soma entre versões.

6. **Regras de sinal/nulidade de taxas não seguem um padrão único — cada uma tem sua própria convenção, fechada na Tela 2:** TMA e Taxa de Reinvestimento vazias significam "não calcular" (`—`); Taxa de Custo de Captação vazia significa "calcular como zero" (resultado válido). Tratar as três com a mesma lógica no engine é bug garantido.

7. **IRPJ é deliberadamente simplificado e igual para os dois regimes tributários** (Tela 4) — o campo Regime Tributário (Tela 1) continua obrigatório como metadado e segue afetando a Alíquota Tributária Efetiva manual (Tela 2), mas não differencia o cálculo de IRPJ. Nota de rodapé obrigatória na UI por transparência com o cliente.

---

## Itens Registrados Como Backlog de v2 (não bloqueiam o MVP, mas devem ser rastreados)

- Contratação avulsa de usuários/contratos além do limite do tier; flexibilização de pool de papéis (Minuta Comercial).
- Reajuste contratual, descasamento de pagamento a fornecedores (Custo, não só Receita), modelo iterativo de Custo Financeiro (Telas 2, 5).
- Percentuais intermediários de Prazo de Pagamento (45/75 dias) — hoje restrito a 30/60/90 (Tela 1).
- Toggle "Considerar Custo Financeiro" nos KPIs — avaliado e descartado, resolvido pela existência do input na origem (Telas 2 e 6).
- Vínculo automático entre Volumetria de Receita e Volumetria de Custo na simulação what-if — descartado, ajuste manual e independente (Tela 7).
- Transferência de titularidade (Owner) — Tela 9.
- Login social e self-signup, incluindo o modelo de governança de criação de conta que ainda não existe — Tela 10.
- Agregação entre módulos (Viabilidade + Precificação + Gestão) na Home da organização — Tela 8.
- Gráficos com eixo temporal na Home da organização — Tela 8.
- Mensagens diferenciadas para KPIs "não atingidos" (hoje, convenção única `—` em todo o conjunto).

---

*Índice gerado ao final da Fase 1 (Análise Crítica) do Prumo Viabilidade — primeiro documento a ser lido pelo Agente Nexus, antes dos 12 documentos que ele referencia.*
