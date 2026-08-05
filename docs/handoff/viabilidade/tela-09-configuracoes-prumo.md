# Especificação de Tela — Handoff para Agente Nexus (PM)
### Módulo: Prumo Viabilidade | Tela 9/10: Configurações

> Serve de input para `01-database-schema.md`, `03-frontend-ux.md` e `04-auth-integrations.md` do módulo Viabilidade. Pressupõe as Telas 1 a 8 já especificadas.

---

## 1. Objetivo

Tela de gestão de perfil (organização e usuário), preferência visual (tema), gestão de usuários da organização e visualização do plano contratado. Concentra tudo que é configuração/administração, fora do fluxo operacional de projetos.

---

## 2. Perfil da Organização (visível a todos, editável por Owner)

| Campo | Observação |
|---|---|
| Nome da Organização | |
| CNPJ | |

---

## 3. Perfil do Usuário (self-service — cada usuário edita o próprio)

| Campo | Observação |
|---|---|
| Nome de Usuário | |
| E-mail de cadastro | Troca exige confirmação via link enviado ao **novo** e-mail antes de efetivar — evita erro de digitação e confirma posse da caixa de entrada. |
| Senha | Troca exige confirmação da senha atual antes de aceitar a nova. Fluxo de "esqueci a senha" (sem sessão ativa) é tratado na Tela 10, não aqui. |

**Nota de escopo:** estas ações são individuais — cada usuário gerencia seu próprio perfil, distinto da Gestão de Usuários (seção 5), que é ação do Owner sobre terceiros.

---

## 4. Tema Claro/Escuro

**Decisão de escopo (exceção deliberada ao Design System):** o playbook de arquitetura define o produto como Dark First por padrão. Para o MVP, adiciona-se uma variante clara **simplificada** — paleta de cores coerente com a marca, sem redesenho completo de componentes ou revisão extensiva de contraste/acessibilidade tela a tela. Justificativa de produto: uso prolongado com números/planilhas gera reclamação de suporte se não houver alternativa ao tema escuro.

- Toggle simples (claro/escuro) nesta tela, preferência persistida por usuário.
- **Fora de escopo:** revisão completa de design system para o tema claro — é uma adaptação de paleta, não um segundo sistema de design com o mesmo nível de detalhamento do Dark First original.

---

## 5. Gestão de Usuários (Owner-only)

- Visível e editável apenas pelo Owner — Executor e Viewer não têm acesso a esta seção.
- **Convidar usuário:** e-mail + papel (Executor ou Viewer). Gera convite com status "Pendente" até aceite.
  - **Convite pendente não conta no limite de Usuários do plano** — só passa a contar após o convidado aceitar. Evita que o Owner "gaste" vagas do plano com convites nunca respondidos.
- **Trocar papel de usuário existente:** Owner pode mover um usuário entre Executor e Viewer a qualquer momento.
- **Remover usuário:** Owner pode remover um usuário da organização, liberando a vaga no limite do plano.
- **Transferência de titularidade (Owner):** fora de escopo do MVP — extensível para v2. Caso necessário no início da operação, tratado manualmente fora do produto (suporte).

---

## 6. Plano Atual (Owner-only, view-only)

- Exibe o tier contratado, uso de capacidade (Usuários e Contratos Ativos — mesmos contadores já especificados nas Telas 1 e 8), e status de assinatura (`subscription_status` do Stripe).
- **100% view-only** — nenhuma lógica de cobrança, upgrade ou downgrade acontece nesta tela. Botão "Gerenciar Assinatura" redireciona ao portal do Stripe (mesmo padrão já fechado no softblock da Tela 1).
- Visível apenas ao Owner — Executor e Viewer não acessam esta seção (dado financeiro/contratual da organização).

---

## 7. Fora de Escopo desta Tela

- **Transferência de titularidade (Owner):** seção 5 — backlog de v2.
- **Redesenho completo de design system para tema claro:** seção 4 — adaptação de paleta simplificada apenas.
- **Qualquer lógica de cobrança, checkout ou alteração de plano:** delegada inteiramente ao portal do Stripe.
- **Fluxo de recuperação de senha sem sessão ativa:** pertence à Tela 10 (Login/Esqueci a senha).

---

## 8. Decisões Técnicas/Fronteiras (input para Nexus)

- Convite de usuário gera registro com estado `pendente` até aceite — o contador de uso de Usuários do plano (já especificado nas Telas 1 e 8) deve considerar apenas convites `aceitos`, nunca `pendentes`, na validação de limite.
- Troca de e-mail requer fluxo de confirmação por link (token de verificação enviado ao novo endereço) antes de efetivar a alteração no registro do usuário — requisito de segurança para o `04-auth-integrations.md`.
- Troca de senha requer reautenticação (senha atual) antes de aceitar a nova — mesmo padrão de segurança, mesmo arquivo.
- Tema claro/escuro é preferência armazenada por usuário (não por organização) — cada membro pode ter sua própria preferência independente dos demais.
- Gestão de Usuários e Plano Atual (seções 5 e 6) exigem controle de acesso por papel no nível de rota/componente, não apenas ocultação visual — Executor e Viewer não devem conseguir acessar essas seções mesmo via chamada direta de API, consistente com o princípio já fechado de que nenhuma regra crítica depende do frontend.
- Perfil da Organização (seção 2) é editável apenas por Owner, mas visível a todos os papéis — mesma lógica de transparência informacional já aplicada a outros dados não sensíveis do módulo.

---

*Documento gerado a partir da Fase 1 (Análise Crítica) do Prumo Viabilidade — pronto para colar no Agente Nexus (PM) junto aos documentos anteriores já fechados.*
