# Especificação de Tela — Handoff para Agente Nexus (PM)
### Módulo: Prumo Viabilidade | Tela 1/10: Cadastro e Consulta de Projetos/Contratos

> Este documento consolida as decisões fechadas na Fase 1 (Análise Crítica) especificamente para a Tela 1. Serve de input para os arquivos `01-database-schema.md`, `03-frontend-ux.md` e `04-auth-integrations.md` do módulo Viabilidade. Não substitui os documentos "Minuta de Requisitos — Estrutura Comercial" e "Resumo — Construção de Telas", que continuam como fonte de decisões gerais.

---

## 1. Objetivo Validado

Especificar a tela porta-de-entrada do módulo Viabilidade: cadastro, listagem, vínculo entre módulos e arquivamento do `contrato_id` mestre — entidade compartilhada entre os 3 módulos do Prumo.

---

## 2. Campos do Cadastro

| Campo | Obrigatório | Observação |
|---|---|---|
| Nome do Projeto | Sim | |
| Cliente | Sim | |
| Data de Início | Sim | |
| Duração | Sim | |
| Nome do Contrato | Sim | |
| Prazo de Pagamento | Sim | Seleção fechada v1: `30` \| `60` \| `90` dias — sem digitação livre nem valores intermediários (45/75 dias fica para v2, nunca acima de 90). Gera efeito de descasamento no Fluxo de Caixa (Tela 5): o recebimento pode ocorrer após o fim da janela do projeto em função apenas do prazo de pagamento — ver detalhamento quando a Tela 5 for especificada. |
| Nome da Versão | Sim | Cria a primeira Versão do projeto (`versao_id`), conforme o modelo Projeto → Versões formalizado na Tela 7. Esta é a versão que abre por padrão até a criação de versões adicionais (a mais recente sempre abre por padrão — sem conceito de versão principal/ativa). |
| **Regime Tributário** | **Sim** | `Lucro Presumido` \| `Lucro Real`. Definido uma única vez no cadastro; imutável no ciclo de vida do projeto (mudança de regime = novo projeto, não edição). Consumido pela Tela 2 (Parâmetros de Input) para cálculo de alíquota. **Nota MVP:** para fins de cálculo automático de IRPJ (Tela 4 — DRE), o valor deste campo não altera a fórmula aplicada — ambos os regimes usam a mesma simplificação (15% + adicional de 10% sobre EBIT mensal excedente a R$20.000). O campo permanece obrigatório como metadado do projeto e segue afetando a Alíquota Tributária Efetiva manual da Tela 2. |
| Status de Ciclo de Vida | Sim (default ao criar) | Enum fechado v1 — ver seção 3. Dado de negócio do cliente, sem relação com contagem de limite comercial. |
| Moeda | Sim (fixo/desabilitado) | BRL, único valor possível no MVP. Campo exibido mas não editável — sinaliza roadmap multi-moeda sem implicar suporte real. |
| Código Interno | Não | Opcional. Sem obrigatoriedade cruzada com nenhuma das 10 telas — validado contra ordem de construção completa. |
| Segmento do Cliente Final | Não | Opcional, mesma justificativa acima. Campo aditivo se demanda de relatório/benchmark surgir pós-MVP. |

---

## 3. Enum de Status de Ciclo de Vida (v1, fechado)

```
Em prospecção
Contrato assinado
Em execução
Encerrado
Cancelado
```

**Regra de negócio:** este status é independente do estado de arquivamento (seção 6). Um projeto pode estar `Encerrado` e ainda contar no limite de Contratos/Projetos Ativos até que o usuário execute a ação de arquivar.

---

## 4. Listagem — Colunas e Filtros

**Colunas:**
- Nome do Projeto
- Cliente
- Status de Ciclo de Vida
- Módulos Vinculados (indicador visual: Viabilidade / Precificação / Gestão)
- Data de Criação

**Filtros:**
- Status de Ciclo de Vida (enum da seção 3)
- Módulos vinculados
- **Arquivado / Não-arquivado** — filtro distinto do status de ciclo de vida; default da listagem é ocultar arquivados, com toggle explícito "Mostrar arquivados"
- Busca livre (nome do projeto / cliente)

---

## 5. Vínculo entre Módulos

**Decisão de escopo (fechada):** a Tela 1 é responsável apenas por **criar/desfazer a referência de vínculo** entre `contrato_id` mestre de módulos adjacentes na cadeia (Precificação↔Viabilidade↔Gestão), incluindo a **importação inicial automática** no momento em que o vínculo é criado (não há dado anterior para gerar diff nesse momento).

**Fora de escopo da Tela 1:** qualquer **reimportação subsequente** com diff (valor antigo vs. novo) — essa mecânica pertence a uma tela dentro do projeto (candidata: Tela 2 — Parâmetros de Input, ou tela própria de sincronização), a ser especificada quando essa etapa for construída.

**Superfície de UI mínima na Tela 1:**
- Ação "Vincular módulo" (seletor do `contrato_id` do módulo adjacente já existente na organização)
- Ação "Desvincular"
- Indicador de módulos vinculados (mesma coluna da listagem, seção 4)

---

## 6. Arquivamento

- Ação inline na listagem, com filtro "Mostrar arquivados" (seção 4).
- **Aviso obrigatório de cascata:** como o arquivamento incide sobre o `contrato_id` mestre compartilhado, a ação cascateia simultaneamente para todos os módulos vinculados. A UI deve exibir confirmação explícita antes de executar, nomeando os módulos afetados — ex.:

  > "Isso vai arquivar o projeto em todos os módulos vinculados: Viabilidade, Precificação. Deseja continuar?"

- Desarquivar segue a mesma regra de permissão de arquivar (seção 7), sujeito à disponibilidade de vaga no limite do tier vigente (ver seção 8 sobre o que ocorre se não houver vaga).

---

## 7. Permissões

| Ação | Owner | Executor | Viewer |
|---|---|---|---|
| Criar projeto | Sim | Sim | Não |
| Editar projeto | Sim | Sim | Não |
| Arquivar | Sim | Sim | Não |
| Desarquivar | Sim | Sim | Não |
| Vincular/Desvincular módulo | Sim | Sim | Não |
| Exclusão permanente | Sim | Não | Não |
| Visualizar/Exportar | Sim | Sim | Sim |

---

## 8. Comportamento ao Atingir Limite de Plano

**Mecanismo:** soft-block com upsell — **não é bloqueio duro**. Frontend desabilita a ação de criar/desarquivar com indicação visual do motivo; backend valida novamente no submit (nenhuma regra crítica depende do estado do frontend, conforme princípio já fechado na Fase 1).

**Copy proposto (placeholder — não travado, sujeito a iteração de growth/marketing):**

> "Você atingiu o limite de [Contratos Ativos / Usuários] do seu plano [Nome do Tier]. Arquive um projeto existente ou faça upgrade para liberar mais espaço."
>
> Botões: `Arquivar um projeto` (leva à listagem com filtro de ativos) | `Fazer upgrade` (leva ao portal de billing)

Aplica-se tanto à criação de novo projeto quanto à ação de desarquivar (mesma trava de limite, mesmo comportamento de UI).

---

## 9. Decisões Técnicas/Fronteiras (input para Nexus)

- Regime tributário: campo imutável pós-criação — não expor como editável em nenhuma tela subsequente; mudança de regime implica novo projeto.
- Status de ciclo de vida: enum fechado v1 (seção 3), sem campo livre — validação de negócio, não custom field.
- Filtro de arquivamento é campo/estado distinto do status de ciclo de vida — não modelar como o mesmo enum nem a mesma coluna no schema.
- A ação de vínculo dispara import automático inicial; toda reimportação subsequente com diff é responsabilidade de tela futura, fora do escopo do `03-frontend-ux.md` desta tela.
- Validação de limite de plano (Contratos Ativos e Usuários) deve existir em duas camadas: frontend (UX, softblock) e backend (autorização real) — requisito não-funcional de segurança, consistente com o `04-auth-integrations.md`.
- Matriz de permissão da seção 7 é input direto para RLS do `contrato_id` mestre no `01-database-schema.md`.
- `contrato_id` mestre é a entidade de projeto compartilhada entre os 3 módulos (nível Tela 1). Dentro do módulo Viabilidade, um `contrato_id` possui uma ou mais Versões (`versao_id`) — todo o schema das Telas 2 a 6 é escopado por `versao_id`, não apenas por `contrato_id`. Ver Tela 7 para o modelo completo de versionamento.

---

*Documento gerado a partir da discussão de construção de telas (Fase 1) do Prumo Viabilidade — pronto para colar no Agente Nexus (PM) junto aos documentos de decisões gerais já fechados.*
