# Minuta de Requisitos — Handoff para Agente Nexus (PM)
### Módulo: Estrutura Comercial Prumo (Viabilidade / Precificação / Gestão)

---

## 1. Objetivo Validado

Definir a estrutura comercial (planos, módulos, capacidades e gatekeeping) para o lançamento dos 3 módulos do Prumo, permitindo contratação modular respeitando a cadeia de dependência de dados (Precificação → Viabilidade → Gestão) e o modelo de deploy já fechado (monolito único, feature-flag por módulo).

---

## 2. Escopo Incorporado

### 2.1. Estrutura de Níveis (4 planos)

| Nível | Módulos incluídos |
|---|---|
| Starter | Viabilidade **ou** Precificação (à escolha do cliente, apenas 1) |
| Pro Planejamento | Viabilidade + Precificação |
| Pro Execução | Viabilidade + Gestão |
| Master | Viabilidade + Precificação + Gestão |

### 2.2. Pré-requisito comercial

- Módulo Gestão **nunca** é vendido isoladamente — exige Viabilidade contratada junto (mesmo nível ou já existente na organização).

### 2.3. Capacidade por nível

| | Starter | Pro Planejamento | Pro Execução | Master |
|---|---|---|---|---|
| Consultor/Analista (Executor) | 1 | 2 | 2 | 3 |
| Somente Leitura (Viewer) | 2 | 3 | 4 | 7 |
| **Total usuários** | 3 | 5 | 6 | 10 |
| **Contratos/Projetos Ativos** | 5 | 12 | 15 | 25 |

> **Nota sobre o contador de Contratos/Projetos Ativos:** o contador incide sobre o `contrato_id` mestre (entidade compartilhada entre os 3 módulos, conforme decisão de arquitetura da Fase 1 de Viabilidade). Um projeto/contrato cadastrado que seja vinculado aos 3 módulos consome apenas **1 unidade** do limite, independente de quantos módulos estejam vinculados a ele. O termo "Ativo" refere-se a **cadastro existente na organização** (o registro do `contrato_id` mestre existe), e não ao status de negociação/execução do projeto (em análise, contrato assinado, encerrado, etc.). O status interno do ciclo de vida do projeto é um dado de negócio do cliente e não interfere na contagem do limite comercial.
>
> **Ação de Arquivamento:** para evitar que contratos encerrados/finalizados ocupem permanentemente uma vaga no limite do plano, o usuário pode **arquivar** um `contrato_id` mestre. Um contrato arquivado deixa de contar no limite de Contratos/Projetos Ativos, mas seu histórico permanece acessível em modo leitura (mesma lógica de preservação de dados aplicada à regra de downgrade, seção 2.4). Arquivamento é reversível (desarquivar volta a consumir 1 unidade do limite, sujeito a haver vaga disponível no tier atual); exclusão permanente do `contrato_id` mestre continua sendo ação distinta, restrita ao Owner, conforme já definido.

- Limite de usuários é **por organização**, independente de quantos módulos contratados.
- Owner é sempre adicional, **não conta** no limite de usuários do plano (decisão já fechada anteriormente).
- Papéis (Executor/Viewer) são **fixos por tier na v1** — cliente não redistribui livremente dentro de um pool único.

### 2.4. Regra de Downgrade

- Ao fazer downgrade (ou cair para módulo fora do plano contratado): **bloqueio de escrita** (criar, editar, rodar simulação) nos módulos/dados fora do novo plano.
- **Leitura e exportação permanecem sempre liberadas**, independente do tier — nunca há bloqueio total de acesso aos dados já existentes.

### 2.5. Gatekeeping por Status de Assinatura (Stripe)

| `subscription_status` | Comportamento |
|---|---|
| `active` | Libera funcionalidades conforme tier contratado |
| `past_due` | Mantém leitura liberada; bloqueia toda escrita |
| `inactive` | Bloqueia tudo, exceto exportação de dados |

---

## 3. Escopo Excluído (fora da v1 — registrar como backlog de v2)

- Contratação avulsa de usuários adicionais (add-on de assento) além do limite do tier.
- Contratação avulsa de contratos/projetos ativos além do limite do tier (metering).
- Flexibilização de pool de usuários (cliente decidindo livremente a mistura Executor/Viewer dentro de um total, em vez de limite fixo por papel).
- Definição de mecanismo de cross-sell in-app (sinalização de upgrade dentro do produto) — decisão de produto/growth a ser tratada separadamente, não bloqueia o PRD técnico.

---

## 4. Regras de Negócio Decididas

1. Combinações comerciais válidas: Viabilidade sozinho, Precificação sozinho, Viabilidade+Precificação, Viabilidade+Gestão, Viabilidade+Precificação+Gestão. **Inválidas:** Gestão sozinho, Precificação+Gestão sem Viabilidade.
2. Limite de usuário e de contrato ativo são **contadores independentes**, ambos aplicados como teto duro por tier (sem cobrança incremental na v1).
3. Downgrade nunca reduz acesso de **leitura/exportação** — apenas de escrita, e apenas nos módulos/capacidade excedente ao novo tier.
4. Gatekeeping técnico é orientado pelo `subscription_status` do Stripe, com 3 estados de comportamento (ativo/inadimplente/inativo) conforme tabela da seção 2.5.
5. O termo "Ativo" no limite de Contratos/Projetos refere-se a **cadastro existente na organização** (o `contrato_id` mestre está registrado), não ao status de negociação/execução do projeto (em análise, contrato assinado, encerrado, etc.). O status interno do ciclo de vida do projeto é um dado de negócio do cliente e não interfere na contagem do limite comercial.
6. O usuário pode **arquivar** um `contrato_id` mestre para liberar vaga no limite comercial sem perder o histórico (leitura preservada). Contrato arquivado não conta no limite de Contratos/Projetos Ativos. Desarquivar volta a consumir 1 unidade do limite (sujeito a disponibilidade de vaga no tier vigente). Exclusão permanente permanece ação distinta, restrita ao Owner.

---

## 5. Decisões Técnicas/Fronteiras

- Este documento **não define** schema de banco, RLS específica ou contratos de API — isso é responsabilidade do Nexus (PM) e, na sequência, do Arquiteto, conforme o playbook `01-database-schema.md` e `04-auth-integrations.md`.
- O Nexus deve considerar que a tabela de capacidade (seção 2.3) e a regra de gatekeeping (seção 2.5) são **inputs obrigatórios** para o `04-auth-integrations.md` (Gatekeeping por Assinatura) do módulo que estiver documentando.
- Regra de bloqueio de escrita no downgrade deve ser refletida como requisito não-funcional de segurança/autorização — a validação de permissão de escrita não pode depender de estado de frontend, conforme já estabelecido na Fase 1 de Viabilidade.
- O contador de Contratos/Projetos Ativos deve ser implementado como uma contagem sobre a entidade `contrato_id` mestre (tabela compartilhada entre os 3 módulos), nunca somado por instância de módulo vinculada.
- A entidade `contrato_id` mestre precisa de um campo de status de arquivamento (ex: `arquivado_em` ou flag booleana) distinto do soft-delete de exclusão permanente — são dois estados diferentes: arquivado (fora da contagem, leitura preservada, reversível) vs. excluído (ação do Owner, tratamento conforme regra já definida na Fase 1 de Viabilidade). O Nexus deve especificar esse campo no `01-database-schema.md` do módulo correspondente.

---

*Documento gerado a partir da discussão comercial (Fase 1 — planos/pricing) dos módulos Prumo — pronto para colar no Agente Nexus (PM) para geração do PRD oficial correspondente.*
