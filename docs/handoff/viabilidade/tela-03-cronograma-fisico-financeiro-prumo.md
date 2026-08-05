# Especificação de Tela — Handoff para Agente Nexus (PM)
### Módulo: Prumo Viabilidade | Tela 3/10: Cronograma Físico-Financeiro

> Serve de input para `01-database-schema.md`, `01b-business-rules-engine.md` e `03-frontend-ux.md` do módulo Viabilidade. Pressupõe a Tela 2 já especificada — linhas de Receita e Custo já existem com Volumetria total, Unidade de Medida, Valor/Custo Unitário, Mês de Início e Prazo definidos.

---

## 1. Objetivo

Tela onde a Volumetria total de cada linha (Receita e Custo) é distribuída ao longo do tempo — automaticamente (linear) por padrão, ou manualmente célula a célula quando há ramp-up ou sazonalidade. É a única tela onde a distribuição temporal é editada; DRE, Fluxo de Caixa e Dashboard leem o resultado desta tela, não o inverso.

---

## 2. Estrutura da Tela

- **Duas abas separadas:** Receita e Custo. Cada aba exibe a tabela de linhas correspondente (já cadastradas na Tela 2) com uma coluna por mês, no eixo temporal do projeto (Data de Início + Duração, definidos na Tela 1).
- **Uma única distribuição por linha:** incide sobre a Volumetria. Não existe distribuição independente de Valor — o Valor (ou Custo) de cada mês é sempre calculado como Volumetria distribuída naquele mês × Valor/Custo Unitário da linha (fixo, definido na Tela 2). A tabela pode exibir a linha de Valor calculado como referência visual, mas ela não é editável em nenhuma célula.

---

## 3. Distribuição Temporal

- **Padrão:** distribuição linear — Volumetria total da linha dividida igualmente entre os meses da janela da linha (Mês de Início até Mês de Início + Prazo, definidos na Tela 2).
- **Override manual:** usuário edita a Volumetria célula a célula, dentro da janela da linha, para refletir ramp-up ou sazonalidade.
- **Validação de soma (obrigatória, a cada edição):** a soma das células de Volumetria de uma linha deve sempre bater com o total definido na Tela 2. Se o usuário editar uma célula e a soma não fechar, a tela exibe aviso inline (ex.: "Soma da distribuição diverge do total da linha em [X] unidades") — não bloqueia o salvamento imediatamente, mas o desvio deve estar sempre visível enquanto existir.
- Esta regra vale igualmente para linhas importadas de Precificação e para linhas nativas do Viabilidade — vínculo de origem **não bloqueia** a distribuição temporal (distribuição é decisão operacional de Viabilidade, distinta da precificação unitária decidida no módulo de origem).

---

## 4. Células Fora da Janela da Linha

Cada linha tem sua própria janela (Mês de Início + Prazo, possivelmente menor que a duração total do projeto). Meses fora dessa janela devem ser visualmente distintos de um valor zero digitado intencionalmente:

- **Fora da janela:** célula cinza, travada (não editável), com um traço (`—`) — significa "esta linha não se aplica neste mês".
- **Dentro da janela, valor zero:** célula branca, editável, com "0" — significa "esta linha se aplica neste mês, mas o valor operacional foi zero" (ex: operação pausada temporariamente sem descontinuar a linha).

Essa distinção é requisito de UI, não apenas de dado — o usuário precisa diferenciar os dois casos ao olhar a tabela.

---

## 5. Reset de Distribuição Manual

- **Por linha:** botão inline na própria linha do cronograma, que limpa todos os overrides manuais daquela linha e a devolve à distribuição linear automática. É a ação que libera a edição de total/prazo bloqueada na Tela 2 (regra de conflito já fechada).
- **Em lote:** botão único na tela (fora da tabela, ex: barra de ações da aba) que executa o reset em todas as linhas da aba corrente de uma vez, para o caso de o usuário querer refazer a distribuição do zero sem repetir a ação linha a linha.
- Ambos os resets pedem confirmação antes de executar (ação destrutiva sobre overrides existentes).

---

## 6. Bloqueio de Linhas Importadas — O Que Não se Aplica Aqui

Diferente da Tela 2 (onde total, prazo e valor unitário de linha importada ficam bloqueados), a distribuição temporal desta tela **é sempre editável**, independente de a linha ter `origem_line_id` preenchido ou não. O único vínculo com a regra de bloqueio da Tela 2 é a validação de soma (seção 3): a distribuição pode ser redesenhada livremente, mas o total permanece o que foi definido (ou importado) na Tela 2.

---

## 7. Fora de Escopo desta Tela

- **Edição de Valor/Custo Unitário:** fixo, definido na Tela 2 — não editável aqui em nenhuma hipótese.
- **Edição de total ou prazo da linha:** pertence à Tela 2. Só fica disponível ali após reset de distribuição manual (seção 5).
- **Capital de Giro, VPL, TIR/TIRM:** KPIs calculados a partir do resultado desta tela combinado com o Fluxo de Caixa — exibidos no Dashboard (Tela 6), não aqui.
- **Descasamento de recebimento por Prazo de Pagamento:** efeito tratado no Fluxo de Caixa (Tela 5), não na distribuição de Volumetria desta tela.

---

## 8. Decisões Técnicas/Fronteiras (input para Nexus)

- Schema de distribuição temporal armazena apenas a série mês a mês de **Volumetria** por `linha_id` (Receita e Custo, cada uma com sua própria série) — Valor/Custo mês a mês é sempre uma coluna calculada em tempo de leitura, nunca persistida como input direto.
- Validação de soma (Volumetria distribuída vs. total da linha) deve rodar no backend a cada gravação, não apenas como aviso visual no frontend — consistente com o princípio de que nenhuma regra crítica depende do frontend.
- Estado "fora da janela da linha" (seção 4) é derivado de Mês de Início + Prazo da linha (Tela 2) comparado ao mês da coluna — não é um valor armazenado, é calculado na renderização.
- Reset de distribuição (individual e em lote) é ação que limpa os registros de override manual da(s) linha(s) afetada(s), revertendo ao cálculo linear — não é uma alteração do total ou do prazo, que continuam preservados.
- Vínculo com Precificação (`origem_line_id`) não impõe nenhuma restrição de edição nesta tela — a única restrição herdada da Tela 2 é sobre total/prazo/unitário, não sobre distribuição.
- **Escopo de versão:** a série de distribuição temporal é escopada por `linha_id`, que por sua vez pertence a uma única `versao_id` (Tela 2). Ao criar uma nova versão (Tela 7), a distribuição de cada linha é copiada junto com a linha — não há série de distribuição compartilhada entre versões.
- **Seletor de Versão:** esta tela exibe o componente global de troca de versão no cabeçalho, especificado na Tela 2 (seção 2b) — incluindo a confirmação obrigatória de alterações não salvas antes de trocar (esta tela permite edição de distribuição manual).

---

*Documento gerado a partir da Fase 1 (Análise Crítica) do Prumo Viabilidade — pronto para colar no Agente Nexus (PM) junto aos documentos anteriores já fechados.*
