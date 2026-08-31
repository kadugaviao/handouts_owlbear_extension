# Projeto: Handouts para Owlbear Rodeo

Extensão que traz o **Journal/Handout do Roll20** para o Owlbear Rodeo: o
mestre abre uma imagem da sua biblioteca numa janela flutuante sobre o mapa,
anota o que quiser, e libera para os jogadores com um clique.

> **Documentação deste projeto**
> - **`README.md`** — como rodar, instalar e resolver problemas comuns.
> - **`PROJETO.md`** (este arquivo) — o que é o projeto, as decisões e o estado.
> - **`documents/spec.md`** — a fonte da verdade: tudo que foi feito, por quê,
>   e o que falta.

---

## 1. Estado atual

| Item | Situação |
|---|---|
| Compilação (`tsc --noEmit`) | ✅ limpa |
| Build (`npm run build`) | ✅ 3 bundles |
| Testes (`npm test`) | ✅ 61 passando |
| Rodando no Owlbear | ✅ confirmado pelo mestre |
| Testado com jogador real | ✅ liberar, reabrir e retirar validados em segunda tela |
| Publicado (deploy) | ❌ só `localhost` |
| Repositório Git | ❌ ainda não inicializado |

**Consequência imediata do "só localhost":** a extensão só existe enquanto o
`npm run dev` está de pé na máquina do desenvolvedor. Num celular ou em outro
computador, `localhost` aponta para o próprio aparelho e o Owlbear responde
*"Não foi possível carregar a extensão: localhost"*. Isso não é defeito — é o
que `localhost` significa. Resolve-se com o deploy (seção 6).

---

## 2. O que faz

**Para o mestre**

- **Biblioteca** — abre o gerenciador de imagens do próprio Owlbear e mostra a
  imagem escolhida na janela estilo Roll20.
- **Anotações privadas** — descrição e notas por handout, que o jogador nunca vê.
- **Show to Players / Retirar** — um único botão que alterna. Liberar coloca o
  handout na lista do jogador *e* abre na tela dele; retirar tira da lista *e*
  fecha o que estiver aberto, na hora.
- **Zoom** — alterna entre tamanho nítido e ampliado.
- **Exportar / Importar** — backup do caderninho em JSON.

**Para o jogador**

- Vê apenas os handouts liberados, e neles apenas **título e imagem**.
- Recebe a janela na tela quando o mestre libera.

---

## 3. A ideia central: onde as coisas moram

O Owlbear impõe um teto duro: **a metadata da sala inteira precisa caber em
16 kB**, dividido com todas as outras extensões instaladas. É pouquíssimo para
um catálogo de imagens.

A solução foi separar armazenamento de apresentação:

```
BIBLIOTECA  →  gerenciador de imagens do Owlbear
               ilimitado, já organiza e nomeia, custo zero para nós

CADERNINHO  →  metadata da sala
               só handouts liberados ou anotados; o resto é podado
```

Um handout aberto da biblioteca, não liberado e sem anotação, **ocupa 0 byte**.
A poda é automática (`isWorthStoring` em `src/core/domain/handout.ts`).

| Situação do handout | Bytes | Cabem |
|---|---|---|
| Aberto da biblioteca, não liberado, sem nota | **0 B** | **ilimitado** |
| Liberado, sem anotação | 188 B | ~53 |
| Anotado, textos curtos (120 caracteres) | 428 B | ~23 |
| Anotado, textos longos (600 caracteres) | 1.388 B | ~7 |

A identidade de um handout é a **URL da imagem**, não um id gerado por nós.
Reabrir o mesmo arquivo da biblioteca reencontra as anotações que já existiam.

---

## 4. Arquitetura

```
manifest.json ──┬─ action.popover  → index.html             (o caderninho)
                ├─ background_url  → pages/background.html (listeners)
                └─                   pages/handout.html    (janela flutuante)
```

```
index.html · pages/handout.html · pages/background.html   (cascas HTML)
src/
├── core/          dados, regras e integração — sem React
│   ├── domain/      handout.ts · limits.ts · backup.ts · url.ts   (puro)
│   └── owlbear/     client.ts · useHandouts.ts · mount.ts · constants.ts
├── ui/            HandoutModal · HandoutList · global.css
└── pages/         journal.tsx · handout.tsx · background.ts
```

**Regra de dependência:** `domain/ ← owlbear/ ← pages/ → ui/`. A `ui/` não
conhece o Owlbear; o `domain/` não conhece nem o SDK nem o React. A regra é
**verificada por teste** (`core/domain/architecture.test.ts`), não apenas
documentada — ela foi violada duas vezes enquanto era só documento.

Cada camada tem README próprio: `src/core/README.md` e `src/ui/README.md`.

### Fluxo do "Show to Players"

```
Mestre clica
  → grava sharedWithPlayers:true na metadata   (permanência: entra na lista)
  → OBR.broadcast.sendMessage(SHARE_CHANNEL)   (efeito imediato: abre na tela)
      → background.ts de cada jogador escuta
      → OBR.popover.open("/handout.html?src=…&title=…")
```

Os listeners vivem no **background**, não no popover: se vivessem no popover,
o jogador com ele fechado — o caso normal — nunca receberia nada.

---

## 5. Modelo de visibilidade

| Campo | Mestre | Jogador |
|---|---|---|
| `title` | vê | vê |
| `imageUrl` | vê | vê |
| `description` | vê | **nunca** |
| `notes` | vê | **nunca** |
| `sharedWithPlayers` | controla | — |

O corte acontece em `useHandouts`, **na fronteira de dados**: os componentes de
UI num cliente de jogador nunca chegam a segurar `description` ou `notes`.

### Aviso de privacidade

O Owlbear **não oferece armazenamento privado**. A lista de `Permission` do SDK
não cobre metadata, e `Player.metadata` é exposto a todos via
`OBR.party.getPlayers()`. O ocultamento aqui é de **interface** — um jogador com
DevTools e paciência conseguiria ler a metadata da sala.

É o mesmo modelo do Roll20, onde as GM Notes ficam no mesmo objeto no servidor,
escondidas por permissão de interface. Suficiente para uma mesa entre amigos.
Se algo for realmente secreto, o lugar dele não é a extensão.

---

## 6. Próximo passo: publicar

Enquanto viver em `localhost`, a extensão só funciona na máquina do
desenvolvedor com o servidor rodando. Para o resto do mundo (e para o celular)
ela precisa de um endereço HTTPS público.

**O detalhe que decide o host:** o projeto usa 5 caminhos absolutos a partir da
raiz — `/logo.svg`, `/icon.svg`, `/`, `/background.html` (no `manifest.json`) e
`/pages/handout.html` (em `core/owlbear/client.ts`). O GitHub Pages serve numa subpasta
(`usuario.github.io/repo/`) e quebraria todos eles.

| Host | Endereço | Raiz? | Custo |
|---|---|---|---|
| **Cloudflare Pages** *(recomendado)* | `projeto.pages.dev` | ✅ | grátis, banda ilimitada |
| Netlify | `projeto.netlify.app` | ✅ | grátis, 100 GB/mês |
| Vercel | `projeto.vercel.app` | ✅ | grátis (hobby) |
| GitHub Pages | `usuario.github.io/repo/` | ❌ | grátis, mas exige ajustar os 5 caminhos |

Detalhes e passo a passo em `documents/spec.md`, seção "Trabalho pendente".

---

## 7. Stack

| Dependência | Versão | Papel |
|---|---|---|
| `@owlbear-rodeo/sdk` | 3.1.0 | comunicação com o Owlbear |
| `react` / `react-dom` | 18.3 | interface |
| `lucide-react` | 0.469 | ícones |
| `vite` | 6.4 | build e servidor de desenvolvimento |
| `typescript` | 5.7 | tipagem |
| `vitest` | 2.1 | testes |

Estilo em CSS Modules, sem framework — a extensão roda num iframe e o peso
importa.
