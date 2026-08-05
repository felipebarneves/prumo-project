# Especificação de Tela — Handoff para Agente Nexus (PM)
### Módulo: Prumo Viabilidade | Tela 10/10: Login / Esqueci a Senha / Aceite de Convite

> Serve de input para `03-frontend-ux.md` e `04-auth-integrations.md` do módulo Viabilidade. Última tela da suíte de 10 — pressupõe todas as anteriores já especificadas, em especial a Tela 9 (origem do fluxo de convite).

---

## 1. Objetivo

Ponto de entrada de autenticação do produto: Login (usuário já existente), Esqueci a Senha (recuperação sem sessão ativa) e Aceite de Convite (variação desta tela, primeira entrada de um usuário convidado pelo Owner — Tela 9).

---

## 2. Escopo de Autenticação (decisões de MVP)

- **Sem login social (Google/OAuth):** apenas e-mail + senha, via Supabase Auth. Login social fica registrado como candidato de v2.
- **Sem self-signup:** não existe fluxo de "criar organização nova sozinho" no MVP — toda organização nasce de provisionamento fora deste fluxo de tela (comercial/manual, no início da operação). Cada usuário individual só ganha acesso via convite do Owner de uma organização já existente (Tela 9) ou como o primeiro Owner provisionado na criação da organização.
- **Nota para v2:** à medida que o volume de organizações crescer, self-signup (com checkout Stripe integrado) provavelmente precisará de tela própria e de um fluxo de governança sobre criação de conta que não existe no MVP — registrado como problema a resolver antes de escalar aquisição, não como falha do MVP atual.

---

## 3. Sub-fluxo: Login

| Campo | Observação |
|---|---|
| E-mail | |
| Senha | |

- Ação "Entrar" autentica via Supabase Auth.
- Link "Esqueci minha senha" leva ao sub-fluxo da seção 4.
- Erro de credencial inválida: mensagem genérica ("E-mail ou senha incorretos"), sem indicar qual dos dois campos está errado — prática padrão de segurança contra enumeração de e-mails cadastrados.

---

## 4. Sub-fluxo: Esqueci a Senha

**Etapa 1 — Solicitar:**
- Campo: E-mail.
- Ação envia link de redefinição para o e-mail informado, se existir conta associada.
- Mensagem de confirmação é a mesma independente de o e-mail existir ou não na base ("Se este e-mail estiver cadastrado, você receberá um link de redefinição") — mesma prática de segurança contra enumeração da seção 3.

**Etapa 2 — Redefinir (a partir do link recebido):**
- Campos: Nova Senha, Confirmar Nova Senha.
- Token do link expira após uso único ou tempo determinado (padrão Supabase Auth) — link expirado ou já usado exibe mensagem de erro com opção de solicitar um novo.

---

## 5. Sub-fluxo: Aceite de Convite (variação desta tela)

- Acessado exclusivamente via link enviado por convite (Tela 9, seção 5) — não há entrada direta por URL pública sem token válido.
- **E-mail pré-preenchido e não editável** (já definido pelo Owner no momento do convite) — papel (Executor/Viewer) também já definido, não é escolha do convidado.
- Campos exibidos: Nome de Usuário, Senha, Confirmar Senha.
- Ao concluir, o convite muda de estado `pendente` para `aceito` (Tela 9) — é este o momento em que o usuário passa a contar no limite de Usuários do plano (regra já fechada na Tela 9).
- Token de convite expirado ou já utilizado: mesma tratativa de erro da seção 4 (mensagem clara + orientação de contatar o Owner para reenvio, já que o reenvio de convite é ação da Tela 9, não desta tela).

---

## 6. Fora de Escopo desta Tela

- **Login social (Google/OAuth):** candidato de v2.
- **Self-signup (criação de organização nova sem convite prévio):** candidato de v2, com nota de que exigirá também um modelo de governança sobre criação de conta ainda não desenhado.
- **Provisionamento do primeiro Owner de uma organização nova:** não modelado como tela nesta rodada — tratado como processo manual/comercial no início da operação, fora do escopo de UI do MVP.

---

## 7. Decisões Técnicas/Fronteiras (input para Nexus)

- Autenticação via Supabase Auth, e-mail + senha apenas — sem integração OAuth no MVP.
- Mensagens de erro em Login e Esqueci a Senha seguem princípio de não-enumeração (nunca confirmar/negar explicitamente se um e-mail existe na base) — requisito de segurança para o `04-auth-integrations.md`.
- Aceite de convite consome o token gerado na Tela 9 e transiciona o estado do convite de `pendente` para `aceito` — este é o gatilho exato que altera a contagem de uso de Usuários do plano (Tela 1, Tela 8, Tela 9), não o momento do envio do convite.
- Sem self-signup no MVP significa que não há endpoint público de criação de organização exposto nesta tela — toda criação de organização/primeiro Owner é assumida como processo fora do fluxo de UI, a ser resolvido operacionalmente até a decisão de v2 sobre self-signup.

---

*Documento gerado a partir da Fase 1 (Análise Crítica) do Prumo Viabilidade — pronto para colar no Agente Nexus (PM) junto aos documentos anteriores já fechados. Encerra a especificação das 10 telas do MVP de Prumo Viabilidade.*
