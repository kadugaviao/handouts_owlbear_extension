# Design — Handouts para Owlbear Rodeo

**Fonte da verdade visual.** O `spec.md` diz o que a extensão faz; este arquivo
diz como ela se parece, e por quê.

- Última atualização: **2026-10-05**
- Estado: **diagnóstico fechado, refatoração não iniciada**
- Requisitos: `documents/spec.md` · Visão geral: `PROJETO.md`

---

## Índice

1. [Diagnóstico: por que parece genérico](#1-diagnóstico-por-que-parece-genérico)
2. [A decisão que organiza tudo](#2-a-decisão-que-organiza-tudo)
3. [Sistema de tokens](#3-sistema-de-tokens)
4. [Identidade visual](#4-identidade-visual)
5. [As mudanças, uma a uma](#5-as-mudanças-uma-a-uma)
6. [Descartado, e por quê](#6-descartado-e-por-quê)

---

## 1. Diagnóstico: por que parece genérico

Não é opinião. São quatro fatos medidos no CSS atual.

| Evidência | Número | O que significa |
|---|---|---|
| Cores literais no CSS | **38** | Nenhum token. Cada ajuste vira caça ao hex |
| Tokens / variáveis CSS | **0** | Não existe tema. Mudar de cor é reescrever 693 linhas |
| Linhas em `global.css` | **14** | Sem escala de tipo, de espaço, de raio ou de sombra |
| Famílias de fonte escolhidas | **0** | `system-ui` é a fonte do sistema operacional |

### O que isso produz

As cinco cores mais usadas são `#ffffff`, `#e0e0e0`, `#cccccc`, `#888888` e
`#1c1c1c` — **cinza puro**. Cinza de sistema é o padrão de qualquer coisa: é
exatamente o que o olho lê como "não foi escolhido".

E o problema maior, que não aparece em nenhum hex: **a extensão é branca e o
Owlbear é escuro.** Um painel claro grudado numa interface escura é o sinal mais
óbvio de "isto aqui é de terceiro". Nenhuma quantidade de polimento resolve
enquanto o fundo brigar com o anfitrião.

---

## 2. A decisão que organiza tudo

> **A extensão acompanha o tema do Owlbear. O botão é um override, não a
> fonte.**

O SDK expõe o tema do anfitrião:

```ts
OBR.theme.getTheme()      // => { mode: "DARK" | "LIGHT", primary, secondary,
                          //      background: { default, paper },
                          //      text: { primary, secondary, disabled } }
OBR.theme.onChange(cb)    // o usuário troca de tema no Owlbear → chega aqui
```

Isso muda o pedido original — *"um botão pra deixar adaptado pra cor mais
escura"* — para algo melhor:

| Opção | Comportamento |
|---|---|
| **Automático** *(padrão)* | Herda `mode` do Owlbear e reage a `onChange` |
| Claro | Força claro, independente do anfitrião |
| Escuro | Força escuro |

**Por que o automático tem que ser o padrão:** quem usa tema escuro no Owlbear
já declarou a preferência uma vez. Pedir de novo é a extensão ignorando o que o
usuário já disse. O override existe para o caso minoritário — ler um handout
muito claro numa sala escura, por exemplo — e fica em `localStorage`, que é
preferência de aparelho, não da sala.

**O que NÃO vamos fazer:** copiar as cores exatas do `theme.primary` do Owlbear
para dentro dos nossos componentes. Herdamos o **modo**; a paleta é nossa. Senão
a extensão vira um clone sem identidade — o oposto do pedido.

---

## 3. Sistema de tokens

Três camadas, nessa ordem. A regra é simples: **componente nunca vê hex.**

```
primitiva  →  semântica  →  componente
--green-600   --accent      --btn-primary-bg
```

### Camada 1 — primitivas

Valores crus, sem significado. Vivem em `global.css` e não são usadas
diretamente por nenhum componente.

### Camada 2 — semântica

O que o token *significa*, não a cor que ele é. É esta camada que troca entre
claro e escuro.

| Token | Papel |
|---|---|
| `--bg` | Fundo da janela |
| `--surface` | Card, painel, barra |
| `--surface-raised` | Elemento sobre o card (confirmação, campo) |
| `--line` | Borda e divisória |
| `--text-1` | Texto principal |
| `--text-2` | Texto secundário, legenda |
| `--text-3` | Texto desabilitado |
| `--accent` | Verde de mesa — ação primária, estado "liberado" |
| `--accent-ink` | Texto sobre o acento |
| `--gold` | Marcação, destaque de "só o mestre vê" |
| `--danger` | Destrutivo, erro |
| `--ring` | Anel de foco |

### Camada 3 — componente

Só quando um componente precisa divergir da semântica. Deve ser raro; se virar
regra, a camada 2 está incompleta.

### Escalas

| Escala | Valores | Observação |
|---|---|---|
| Espaço | 4 · 8 · 12 · 16 · 24 · 32 | Densidade alta: o painel tem 320 px |
| Tipo | 11 · 12 · 13 · 15 · 18 · 22 | Base 13, não 16 — é painel, não página |
| Raio | 4 · 8 · 12 · 999 | |
| Sombra | 3 níveis, só no escuro-sobre-escuro | |

> **Sobre o tamanho base 13 px:** a regra geral de 16 px vale para páginas de
> leitura. Este é um painel lateral de 320 px dentro de outro aplicativo, e o
> Owlbear usa escala menor — 16 px aqui faria a lista caber em quatro itens.
> Os textos longos (descrição, notas) ficam em 15 px.

---

## 4. Identidade visual

**Direção: feltro e latão.** Verde de mesa de jogo como acento, dourado
envelhecido como marcação. É a referência física do RPG de mesa sem cair na
fantasia genérica — nada de pergaminho, nada de fonte medieval.

### Paleta — **todos os pares verificados contra a WCAG**

**Escuro** (padrão, acompanha o Owlbear)

| Token | Hex | Contraste |
|---|---|---|
| `--bg` | `#12161C` | — |
| `--surface` | `#191F27` | — |
| `--surface-raised` | `#222A35` | — |
| `--line` | `rgba(255,255,255,.09)` | — |
| `--text-1` | `#E8EDF2` | **14.07:1** sobre superfície |
| `--text-2` | `#9FADBC` | **7.25:1** |
| `--accent` | `#4FA873` | **5.67:1** |
| `--gold` | `#E0AE4A` | **8.15:1** |
| `--danger` | `#F2766A` | **5.98:1** |

**Claro**

| Token | Hex | Contraste |
|---|---|---|
| `--bg` | `#FBFAF7` | branco **quente** — `#ffffff` puro é o cinza do genérico |
| `--surface` | `#FFFFFF` | — |
| `--text-1` | `#1A1D21` | **16.91:1** |
| `--text-2` | `#5B6670` | **5.87:1** |
| `--accent` | `#2E7D52` | **5.03:1** |
| `--gold` | `#8A6212` | **5.47:1** |
| `--danger` | `#B3261E` | **6.54:1** |

Mínimos aplicados: 4.5:1 para texto, 3:1 para elemento não textual. Nenhum par
passa raspando — o menor é 5.03:1.

### Tipografia

Sem webfont. **Decisão deliberada**, não preguiça:

- a extensão roda em iframe e **todo byte conta** — a página de background já
  é medida em kB no `spec.md`;
- uma fonte externa pede `fonts.gstatic.com`, que é mais uma origem para o
  navegador resolver antes do primeiro texto aparecer;
- a identidade aqui vem de **cor, espaço e densidade**, não de fonte display.
  Orbitron ou similar brigaria com a interface do Owlbear em vez de conversar
  com ela.

O que muda é o **uso**: escala definida, pesos com papel (600 em títulos, 500
em rótulos, 400 em corpo) e `font-variant-numeric: tabular-nums` nos números do
orçamento, que hoje dançam quando mudam de largura.

---

## 5. As mudanças, uma a uma

Ordem de execução. Cada uma deixa a árvore verde e pode ser commitada sozinha.

### V1 — Fundação: tokens e escalas *(bloqueia todas as outras)*

`global.css` passa de 14 linhas para o sistema da §3: primitivas, semântica
nos dois temas, escalas. Nenhum componente muda ainda.

Inclui `color-scheme` e o respeito a `prefers-reduced-motion`.

### V2 — Tema do Owlbear

Novo `core/owlbear/theme.ts` (camada `owlbear/`, a única que fala com o SDK) +
hook que aplica `data-theme` na raiz. O override de três estados em
`localStorage`.

**Teste:** o modo inicial segue `getTheme()`; `onChange` reage; o override vence
o anfitrião; `localStorage` indisponível não derruba nada.

### V3 — `HandoutList`: lista e cabeçalho

Substitui as 38 cores pelos tokens. O que muda de verdade:

- **Item da lista** ganha área de toque de 44 px, estado `:hover`/`:focus-visible`
  e a miniatura com raio e borda — hoje é uma imagem solta.
- **Ponto verde de "liberado"** vira um selo com o acento, não um ícone cinza.
- **Lista vazia** deixa de ser parágrafo corrido e vira estado ilustrado com uma
  ação só.

> Os **28 testes do `HandoutList`** consultam papel, texto e `aria-label` — não
> classe CSS. A refatoração visual não deve quebrar nenhum. Se quebrar, é sinal
> de que mudei comportamento, não aparência.

### V4 — `HandoutList`: barra de orçamento, erros e confirmações

- Orçamento com `tabular-nums` e cor semântica por faixa.
- Erro e confirmação viram superfícies elevadas com a cor de perigo, hoje
  improvisada em `#fdecea`.

### V5 — `HandoutModal`: moldura e cabeçalho

O card ganha hierarquia: superfície, borda de 1 px, sombra do token. O cabeçalho
separa **identidade** (ícone + título) de **ações** com espaço, não com borda.

### V6 — `HandoutModal`: a seção do mestre

Hoje é um bloco cinza com um cadeado. Passa a usar o **dourado** como marcação —
é a única informação privada da tela e precisa se distinguir à primeira vista.

### V7 — Movimento

Discreto, com propósito. Transição de 150 ms em estados interativos, `transform`
e `opacity` apenas. Entrada do modal a partir da origem.

**Nada de parallax, nada de 3D.** Ver §6.

### V8 — Acessibilidade

Anel de foco visível de 2 px em tudo que é interativo, foco preso dentro do
modal (já listado como P5 no `spec.md`) e verificação dos dois temas.

---

## 6. Descartado, e por quê

A consulta à base de design devolveu, para "RPG de mesa / imersivo", um padrão
de **landing page** (*Hero → grade de recursos → prova social → CTA*) e o estilo
**3D & Hyperrealism**, com WebGL, parallax de 3–5 camadas e a fonte Orbitron.

Nada disso entra, e as razões valem registro:

| Recomendado | Por que não |
|---|---|
| Estrutura de landing page | Isto é um painel de 320×460 dentro de outro aplicativo. Não existe "hero" nem CTA |
| WebGL / Three.js | O Owlbear já roda WebGL para o mapa. Competir por GPU numa extensão é indefensável |
| Parallax de 3–5 camadas | Movimento decorativo numa ferramenta que o mestre usa no meio da sessão |
| Orbitron + JetBrains Mono | Fonte display sci-fi brigaria com a interface do anfitrião. Ver §4 |
| Sombras complexas | A própria saída listou "evitar sombras complexas" como anti-pattern, contradizendo o estilo que recomendou |

O que foi aproveitado: a nota de cor *"felt green + gold on dark"*, a densidade
alta e o nível de movimento discreto.

**Também descartado:** copiar a paleta do Owlbear via `theme.primary`. Herdamos
o modo, não a identidade — ver §2.
