`Type: Identidade de Marca` · `Version: 1.0` · `Owner: Felipe Neves`

# Identidade de Marca — Neves Soluções

> Documento de referência para geração de conteúdo, UI e comunicação alinhados com a marca. Otimizado para uso em Claude Code e Claude Cowork - pode ser lido diretamente por um agente para orientar decisões de design e copy sem intervenção manual.
>
> Ver nota de escopo em `MY_BUSINESS/anti-ai-writing-style.md` sobre a diferença entre este documento (tom de voz externo, copy de marca) e aquele (estilo de interação Felipe↔IA).

---

## 1. Visão Geral e Posicionamento

- **Marca:** Neves Soluções
- **Domínio:** felipebarneves.me
- **Estilo declarado no código:** "Tech/Premium Dark Theme"
- **Responsável:** Felipe Neves
- **Proposta central:** AI Product Builder - produtos e consultoria em análise financeira e precificação para PMEs técnicas sem rigor financeiro.
- **Personalidade de marca:** sóbria, técnica, confiante - dark theme premium com um único acento de cor (dourado), usado com moderação para sinalizar autoridade e prova, não decoração. Não é marca "amigável/pastel"; é rigor técnico com acabamento sofisticado.

---

## 2. Tom de Voz (Diretrizes para IA)

**Estilo de comunicação**
- Direto, técnico, sem enrolação. Frases curtas, verbos no presente, afirmação sempre seguida de prova concreta.
- Vocabulário de negócios/engenharia usado com naturalidade (termos em inglês quando são padrão de mercado), sem jargão vazio - todo termo técnico vem amarrado a um resultado ou número.
- Contraste explícito "problema → solução" é um recurso recorrente: a marca nomeia a dor antes de apresentar a resposta.
- Dado concreto (valor, prazo, percentual) sustenta qualquer afirmação de valor; evita adjetivo vago sem número ao lado.
- Estrutura numerada e modular - comunicação organizada como sistema, não como texto corrido.
- Travessão (-) usado com frequência para aposição e ênfase.
- Autoridade construída por tempo de experiência e resultado, não por adjetivo autoatribuído.

**O que fazer**
- Afirmar com dado, não com opinião solta.
- Nomear o problema do leitor antes de oferecer a solução.
- Preferir frases curtas e diretas a períodos longos.

**O que NÃO fazer**
- Linguagem "vendedora" genérica, promessa vaga ou hype sem lastro.
- Emojis ou tom informal-fofo.
- Passivas excessivas ou rodeio antes do ponto central.
- Prometer resultado sem condicionar a um método/processo verificável.

---

## 3. Paleta de Cores

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#07111F` | Fundo principal (quase preto azulado) |
| `--bg-card` | `#0B1929` | Fundo de cards e superfícies elevadas |
| `--bg-glass` | `rgba(11,25,41,0.65)` | Superfícies com efeito glass/blur |
| `--gold-1` | `#C8883A` | Dourado escuro — labels, ícones, texto de destaque, bordas de ênfase |
| `--gold-2` | `#E8A855` | Dourado claro — ponto final do gradiente |
| `--gold-grad` | `linear-gradient(135deg, #C8883A 0%, #E8A855 100%)` | Gradiente de marca — números/estatísticas e botão sólido |
| `--silver` | `#A8B4C0` | Texto de corpo (parágrafos) |
| `--white` | `#EDF1F5` | Títulos e texto principal |
| `--border` | `rgba(168,180,192,0.09)` | Borda padrão, quase invisível |
| `--border-gold` | `rgba(200,136,58,0.22)` | Borda de destaque/hover |
| `--glow-gold` | `rgba(200,136,58,0.07)` | Fundo de glow/hover |

**Regra de uso**: o dourado é o único acento cromático da marca — tratar como recurso escasso, reservado a números, CTAs, labels e estados de hover. Nunca usar como cor de fundo em grandes áreas.

---

## 4. Tipografia

| Papel | Fonte | Uso |
|---|---|---|
| Display (títulos) | `--font-display: 'Space Grotesk', sans-serif` | h1–h4, peso 700 (h4 em 600), `letter-spacing` negativo (-0.01 a -0.025em) |
| Corpo | `--font-body: 'DM Sans', sans-serif` | Parágrafos, cor `--silver`, `line-height` 1.65–1.88 |
| Mono | `--font-mono: 'JetBrains Mono', monospace` | Labels, tags, números de fase, stats — sempre uppercase, `letter-spacing` 0.1–0.2em, tamanho pequeno (~0.63–0.7rem) |

**Escala de títulos:** h1 `clamp(2.6rem, 5.5vw, 5rem)` · h2 `clamp(2rem, 3.5vw, 3.4rem)` · h3 `clamp(1.3rem, 2vw, 1.85rem)` · h4 `1.05rem` / 600

**Nota técnica:** as três famílias precisam ser carregadas via serviço de fontes (Google Fonts ou equivalente) no projeto de destino.

---

## 5. Ícones e Logos

Três arquivos oficiais, todos PNG, fundo transparente, 2000×2000px - em `assets/logo/` junto deste guia.

| Arquivo                                                                                     | Conteúdo                   | Cor do texto                        | Uso recomendado                                                                                              |
| ------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `icone-fundo-transparente.png` ![[icone-fundo-transparente.png\|120]]                       | Só o símbolo, sem nome     | -                                   | Favicon, ícone de app, avatar de rede social, marca d'água, qualquer aplicação pequena onde o nome não caiba |
| `logo-texto-cinza-fundo-transparente.png` ![[logo-texto-cinza-fundo-transparente.png\|120]] | Símbolo + "Neves Soluções" | Cinza-claro, `#E6E6E6`              | **Versão principal** - para fundos escuros, compatível com o dark theme do site (`--bg #07111F`)             |
| `logo-texto-azul-fundo-transparente.png` ![[logo-texto-azul-fundo-transparente.png\|120]]   | Símbolo + "Neves Soluções" | Azul-marinho quase preto, `#102231` | Fundos claros - documentos impressos, apresentações em fundo branco, assinatura de e-mail                    |

**O símbolo:** monograma que funde as iniciais N e S num único glifo, nas cores da marca - prata/cinza em gradiente, um traço central em azul-marinho escuro, e a metade direita no gradiente dourado `--gold-grad`. 

**Regra de uso**: escolher a versão pelo fundo, não pelo canal - cinza em fundo escuro, azul em fundo claro, nunca o inverso (perde contraste). Reservar uma área de respiro ao redor do símbolo equivalente à altura de um dos braços do "N" antes de qualquer uso lado a lado com outros elementos.

- **Logo tipográfico em CSS:** `.logo-text` usa `--font-display`, peso 700, 1.1rem, cor `--white` - é o wordmark usado na navegação do site quando não há espaço para a imagem completa da logo. No rodapé, mesma classe com opacidade reduzida (0.45).
- **Slot de imagem/logo em CSS:** `.nav-logo img` reserva altura fixa de 75px - é onde a logo-imagem (cinza, para fundo escuro) deve entrar.
- **Ícones de seção:** `.fase-icon` - quadrado 46×46px, borda dourada sutil, fundo `--glow-gold`, raio 10px, ícone centralizado em `--gold-1`. Padrão para qualquer ícone funcional (numeração de fase/etapa) — não usar o símbolo da marca aqui, é um slot para ícones de conteúdo, não para a logo.

---

## 6. Elementos Visuais e Componentes

**Raio e espaçamento**
- `--radius: 8px` - botões e elementos pequenos
- `--radius-lg: 14px` - cards, boxes, seções destacadas
- Container: `max-width: 1180px`, padding lateral `2rem`
- Seções: `padding: 6rem 0` (4rem em mobile)

**Botões — 3 variantes**

| Variante | Estado padrão | Hover |
|---|---|---|
| `.btn-primary` | Transparente, borda dourada, texto dourado | Preenche com `--gold-grad`, texto vira `--bg`, sombra dourada |
| `.btn-secondary` | Fundo glass leve, borda neutra | Borda e texto viram dourado, fundo `--glow-gold` |
| `.btn-solid` | Sempre preenchido com `--gold-grad`, texto `--bg` | Brilho +6%, sombra mais forte, leve elevação |

**Cards e superfícies**
- Fundo padrão quase invisível: `rgba(255,255,255,0.015–0.018)`
- Borda sutil (`--border`) → borda dourada (`--border-gold`) no hover
- Elevação sutil no hover: `translateY(-2px a -4px)` + sombra
- Números/estatísticas sempre em `--font-mono` ou `--font-display` com `--gold-grad` via `background-clip: text` (texto "esculpido" em gradiente)

**Padrões de "prova" recorrentes**
- Blocos de credenciais e resultados (`.cred-item`, `.resultado-item`): número grande em gradiente dourado + label pequeno em silver
- Comparação lado a lado "problema → solução" (`.caminho-card`, tabelas de stack de soluções): recurso visual coerente com o tom de voz

**Efeitos e motion**
- Transição padrão: `--tr: 0.28s ease` em quase toda interação
- Glow radial sutil (`rgba(200,136,58,0.05–0.1)`) atrás de heros - nunca saturado
- Nav com `backdrop-filter: blur(22px)` ao rolar a página
- Cards flutuantes (`.float-card`) com animação Y suave (6.5–8s, delays escalonados) - sensação de "sistema vivo" sem ser chamativo
- Ponto pulsante (`.hero-tag-dot`) sinalizando "ao vivo/ativo"
- Fade-in em scroll, com atraso escalonado por elemento

---

## 7. Grid e Responsividade

| Breakpoint | Mudanças principais |
|---|---|
| `≤1024px` | Grids de 4 colunas (credenciais, deliverables, execução) caem para 2 |
| `≤900px` | Heros e bloco "sobre" viram coluna única; visual do hero reduz altura |
| `≤768px` | Nav vira hambúrguer; maioria das grades vira coluna única; padding de seção cai para 4rem |
| `≤480px` | Últimas grades em 2 colunas caem para 1; elementos decorativos do hero são ocultados |

---

## 8. Proibições (Anti-Patterns)

- Sem fundos claros/brancos como base - marca é dark-first; não inverter para light theme.
- Sem dourado como cor de fundo em blocos grandes - é acento, não cor primária.
- Sem sombras pesadas - todas as sombras do sistema são suaves (blur alto, opacidade baixa).
- Sem bordas grossas - padrão é 1px, quase invisível em repouso.
- Sem excesso de raio "pill" - 100% arredondado só em badges/tags pontuais (`.badge-soon`, `.hero-tag`), nunca em botões ou cards.
- Evitar fotografia de banco de imagens genérica - o tom "trincheira técnica" pede imagem real ou ilustração custom.
- Evitar linguagem de marketing raso no copy (hype, superlativo sem dado) - incompatível com o tom de voz identificado.
- Evitar emojis em qualquer peça de comunicação da marca.

---

## 9. Referência Rápida — Tokens CSS

```css
:root {
  --bg:           #07111F;
  --bg-card:      #0B1929;
  --bg-glass:     rgba(11, 25, 41, 0.65);
  --gold-1:       #C8883A;
  --gold-2:       #E8A855;
  --gold-grad:    linear-gradient(135deg, #C8883A 0%, #E8A855 100%);
  --silver:       #A8B4C0;
  --white:        #EDF1F5;
  --border:       rgba(168, 180, 192, 0.09);
  --border-gold:  rgba(200, 136, 58, 0.22);
  --glow-gold:    rgba(200, 136, 58, 0.07);

  --font-display: 'Space Grotesk', sans-serif;
  --font-body:    'DM Sans', sans-serif;
  --font-mono:    'JetBrains Mono', monospace;

  --max-width: 1180px;
  --tr:        0.28s ease;
  --radius:    8px;
  --radius-lg: 14px;
}
```

---

## 10. Checklist para Geração de UI/Conteúdo (Claude Code / Cowork)

- [ ] Tema escuro por padrão - `--bg` como fundo base, nunca branco puro
- [ ] Dourado só em: números/estatísticas, labels mono, bordas de hover, botões (conforme variante)
- [ ] Títulos em Space Grotesk, corpo em DM Sans, labels/mono em JetBrains Mono
- [ ] Radius: 8px em botões, 14px em cards
- [ ] Hover = leve elevação + borda dourada, nunca mudança brusca de cor de fundo
- [ ] Copy: frase curta, dado concreto, contraste problema→solução, sem emoji, sem hype
- [ ] Toda estatística/prova numérica formatada como texto grande em gradiente dourado
