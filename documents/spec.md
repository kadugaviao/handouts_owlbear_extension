# Especificação e histórico — Handouts para Owlbear Rodeo

**Fonte da verdade do projeto.** Registra o que foi decidido, o que foi
construído, o que foi verificado de fato e o que falta.

- Última atualização: **2026-08-31**
- Estado: funcional em desenvolvimento, **não publicado**
- Visão geral: `PROJETO.md` · Como rodar: `README.md`

---

## Índice

1. [Requisitos](#1-requisitos)
2. [Decisões e o porquê de cada uma](#2-decisões-e-o-porquê-de-cada-uma)
3. [Restrições do Owlbear descobertas](#3-restrições-do-owlbear-descobertas)
4. [Histórico do que foi construído](#4-histórico-do-que-foi-construído)
5. [Bugs encontrados e corrigidos](#5-bugs-encontrados-e-corrigidos)
6. [Estado de verificação](#6-estado-de-verificação)
7. [Trabalho pendente](#7-trabalho-pendente)
8. [Ideias descartadas e por quê](#8-ideias-descartadas-e-por-quê)

---

## 1. Requisitos

### Funcionais — implementados

| # | Requisito | Onde |
|---|---|---|
| R1 | Janela flutuante estilo Roll20 sobre o mapa | `ui/HandoutModal.tsx` |
| R2 | Cabeçalho: ícone + título à esquerda; Show/Edit/Zoom/X à direita | `ui/HandoutModal.tsx` |
| R3 | Abrir imagem da biblioteca do Owlbear | `core/owlbear/client.ts` |
| R4 | Editar título, imagem, descrição e notas | `ui/HandoutModal.tsx` (modo `editing`) |
| R5 | Descrição e notas são exclusivas do mestre | `core/owlbear/useHandouts.ts` |
| R6 | Liberar handout para os jogadores (lista + pop-up) | `pages/handout.tsx` |
| R7 | Retirar: some da lista **e** fecha a janela aberta | `core/owlbear/client.ts` |
| R8 | Jogador vê só o que foi liberado, e só título + imagem | `core/domain/handout.ts` |
| R9 | "X" fecha só no cliente local, sem afetar a sala | `core/owlbear/client.ts` |
| R10 | Zoom entre tamanho nítido e ampliado | `ui/HandoutModal.module.css` |
| R11 | Exportar/importar o caderninho em JSON | `core/domain/backup.ts` |
| R12 | Não estourar o limite de metadata da sala | `core/domain/limits.ts` |

### Funcionais — adiados conscientemente

| # | Requisito | Motivo |
|---|---|---|
| R13 | Journal próprio do jogador (ele criar handouts e anotações) | Decisão explícita: fazer o do mestre funcionar primeiro |

### Não-funcionais

- **NF1** — A UI não importa o SDK do Owlbear. Todo acesso passa por `src/core/`.
- **NF2** — Cada handout deve custar o mínimo possível de metadata.
- **NF3** — Falhas de escrita precisam virar mensagem legível, nunca silêncio.
- **NF4** — Todo dado que cruza uma fronteira não confiável é validado antes do uso.
- **NF5** — A regra de dependência entre camadas é verificada por teste.

---

## 2. Decisões e o porquê de cada uma

### D1 — Imagens ficam na biblioteca do Owlbear, não na extensão

`OBR.assets.downloadImages()` abre o gerenciador de imagens do próprio Owlbear.
O arquivo sobe para o CDN deles e voltamos com uma URL pública que **todos os
jogadores enxergam**.

*Alternativa descartada:* subir arquivo local pela extensão. Um arquivo do disco
vira `blob:`, que existe só naquele navegador — o jogador receberia link morto.

### D2 — A identidade do handout é a URL da imagem

Não um `id` gerado por nós. Assim, reabrir o mesmo arquivo da biblioteca
reencontra as anotações que já existiam, sem precisarmos manter um índice
paralelo da biblioteca inteira.

*Histórico:* a primeira versão usava `crypto.randomUUID()`. Mudou junto com D3.

### D3 — A metadata guarda só o que é liberado ou anotado

O teto de 16 kB (ver [§3](#3-restrições-do-owlbear-descobertas)) torna
impossível manter um catálogo. A poda é automática em `isWorthStoring`: um
handout que não está liberado e não tem anotação já é integralmente descrito
pela biblioteca do Owlbear — guardar de novo seria desperdício.

**Efeito:** a biblioteca é ilimitada; só o que está no ar agora, ou o que foi
escrito, ocupa espaço.

### D4 — Privacidade é de interface, não criptográfica

O SDK do Owlbear **não oferece armazenamento privado**: a lista de `Permission`
não cobre metadata, e `Player.metadata` vaza via `OBR.party.getPlayers()`.

*Alternativa descartada:* guardar o conteúdo do mestre no `localStorage`. Custos
que decidiram contra:
1. Perde tudo ao trocar de máquina.
2. Perde tudo ao publicar — `localhost` e o domínio de produção são **origens
   diferentes**, e `localStorage` não migra.
3. "Liberar" viraria migração entre dois bancos — onde bugs moram.
4. Co-mestre não veria nada.
5. Não protege de verdade: a imagem já está num CDN público.

*Compensação adotada:* exportar/importar JSON como rede de segurança.

### D5 — Jogador vê apenas título e imagem

Descrição **e** notas são exclusivas do mestre, mesmo depois do handout ser
liberado. Mais restritivo que o Roll20, onde a descrição é pública.

O corte acontece em `useHandouts`, na fronteira de dados — não na renderização.
Um cliente de jogador nunca chega a segurar esses campos.

### D6 — "Show to Players" faz duas coisas; "Retirar" desfaz as duas

```
Liberar  = grava sharedWithPlayers:true   (permanência: entra na lista)
         + broadcast SHARE_CHANNEL        (efeito imediato: abre na tela)

Retirar  = grava sharedWithPlayers:false  (some da lista; registro podado)
         + broadcast REVOKE_CHANNEL       (fecha o que estiver aberto)
```

Copia o Roll20 (onde "Show to Players" liga a permissão *In Player's Journals*)
mas **conserta a dor dele**: no Roll20 não há como retirar com facilidade.

### D7 — Um botão único que alterna, não dois botões

Preserva os 4 botões especificados no cabeçalho, e o texto do botão informa o
estado atual sem precisar de indicador separado.

### D8 — Os listeners vivem na página de background

`background_url` no manifest. Se vivessem no popover, o jogador com o popover
fechado — o caso normal — nunca receberia nada.

### D9 — CORS liberado só para o Owlbear, nunca `cors: true`

Um servidor de desenvolvimento com CORS aberto deixa **qualquer página que você
visite** ler o código-fonte do projeto.

---

## 3. Restrições do Owlbear descobertas

Todas verificadas na documentação oficial ou no código do SDK instalado.

| # | Restrição | Fonte | Consequência no projeto |
|---|---|---|---|
| C1 | Metadata da sala inteira **< 16 kB**, dividida com todas as extensões | [Room API](https://docs.owlbear.rodeo/extensions/apis/room#setmetadata) | `core/domain/limits.ts`: orçamento de 10 kB, barra a 75%, escrita recusada com mensagem |
| C2 | Payload de broadcast **< 16 kB** | [Broadcast API](https://docs.owlbear.rodeo/extensions/apis/broadcast) | Mandamos ~150 B (URL + título) |
| C3 | Sem armazenamento privado — `Permission` não cobre metadata; `Player.metadata` vaza via `party.getPlayers()` | SDK `lib/types/Permission.d.ts`, `lib/api/PartyApi.d.ts` | D4: privacidade é de interface |
| C4 | Campo do manifest é `background_url`, **não** `background` | Manifests oficiais (Dice, Weather) | Corrigido antes do primeiro build |
| C5 | Manifest: `name` ≤ 45 e `description` ≤ 128 caracteres | [Manifest ref](https://docs.owlbear.rodeo/extensions/reference/manifest) | Atual: 8 e 54 — folgado |
| C6 | Manifest aceita `permissions` (lista fechada) | idem | `clipboard-write` declarada para o fallback do export |
| C7 | `setMetadata` faz **spread** entre chaves; substitui só a nossa | [Room API](https://docs.owlbear.rodeo/extensions/apis/room#setmetadata) | Read-before-write continua necessário para concorrência dentro da nossa chave |
| C8 | `OBR.isAvailable` diz se a página está embutida no Owlbear | [OBR base](https://docs.owlbear.rodeo/extensions/apis/) | `mount.ts` mostra aviso em vez de página em branco |
| C9 | Popover aceita `hidePaper`, `disableClickAway`, âncora | [Popover API](https://docs.owlbear.rodeo/extensions/apis/popover) | Todos usados |
| C10 | Instalação é em **owlbear.app/profile**, e a extensão precisa ser **habilitada no diálogo de criar sala** | [Tutorial](https://docs.owlbear.rodeo/extensions/tutorial-hello-world/install-your-extension) | README corrigido |
| C11 | Extensões rodam em **iframe de origem diferente** | [Getting Started](https://docs.owlbear.rodeo/extensions/getting-started) | Inviabiliza acesso a pastas locais (ver [§8](#8-ideias-descartadas-e-por-quê)) |

---

## 4. Histórico do que foi construído

### Etapa 1 — Estrutura inicial

Scaffold Vite + React + TypeScript com três entradas (`index.html`,
`handout.html`, `background.html`), manifest, ícones, e a primeira versão do
`HandoutModal` e do `HandoutList`.

**Verificação do SDK feita antes de escrever:** confirmou `assets`, `broadcast`,
`popover`, `room`, `player`. **Pegou um erro:** o campo do manifest é
`background_url`, não `background` (C4).

### Etapa 2 — Auditoria e endurecimento

Auditoria do código encontrou 6 lacunas; a implementação revelou mais 2.
Todas listadas em [§5](#5-bugs-encontrados-e-corrigidos) (B1–B8).

Adicionados nesta etapa: campos `description` e `notes`, filtro de visibilidade,
botão que alterna Show/Retirar, canal de "retirar", backup em JSON.

### Etapa 3 — Leitura da documentação oficial

Trouxe C1, C5, C6, C7, C8, C10. Resultou em:

- `src/core/domain/limits.ts` — guarda do orçamento de 16 kB
- `src/core/owlbear/mount.ts` — checagem de `OBR.isAvailable`
- `permissions: [clipboard-write]` no manifest + botão "Copiar" no fallback
- README corrigido quanto à instalação

### Etapa 4 — Biblioteca ilimitada

Reescrita da camada de dados a partir da pergunta *"como economizar memória?"*.
Identidade passou de UUID para URL da imagem (D2); poda automática (D3).

Capacidade medida antes e depois:

| Situação | Antes | Depois |
|---|---|---|
| Aberto da biblioteca, não liberado, sem nota | 233 B | **0 B** |
| Liberado, sem anotação | 233 B | 188 B |
| Anotado, texto longo | 1.433 B | 1.388 B |
| **Total viável no orçamento** | ~7 a 43 | **ilimitado** + ~53 liberados |

Adicionados 8 testes cobrindo a poda e o corte de visibilidade.

### Etapa 5 — Correção de CORS

Ver B9.

### Etapa 6 — Correção visual

Ver B10 e B11.

### Etapa 18 — Revisão arquivo a arquivo

Auditoria completa antes de publicar. Achado um bug real (B21); o resto do
código passou sem apontamentos.

**Limpo:** nenhuma classe CSS órfã, nenhuma dependência sem uso, camadas
respeitadas, nenhuma promessa sem tratamento nos caminhos de erro.

**Documentação corrigida** — os READMEs de camada descreviam código removido:
`ui/README` afirmava `max-height: 80vh` (retirado no B14, era a causa da
espiral de morte) e que `Esc` não fechava; `core/README` dizia que
`readHandouts` roda a cada mudança de metadata e que `checkBudget` é apenas
memoizado. README que descreve código inexistente engana quem confia nele.

### Etapa 17 — Versionamento, CI, lint e licença

**Versionamento.** Trabalho das Etapas 13–16 dividido em 5 commits, agrupados
pelo critério de que **cada um compile isoladamente** — verificado com
`git rebase --exec 'npx tsc --noEmit'`. É o que faz `git bisect` funcionar e
`git revert` ser seguro. `src/ui/HandoutList.tsx` carregava três mudanças ao
mesmo tempo e foi inteiro para um commit: fatiar hunks geraria commits
quebrados, o que é pior que baixa granularidade.

**CI.** `.github/workflows/ci.yml` roda lint, testes e build em Node 22 a cada
push e pull request. `npm ci` em vez de `npm install`, para instalar exatamente
o que está no lock. `actions/checkout` e `actions/setup-node` na v5 — a v4 usa
Node 20, que o GitHub está aposentando.

**ESLint.** Configuração flat com `typescript-eslint` e `eslint-plugin-react-hooks`.
Ele encontrou **dois erros reais**, ambos do mesmo anti-padrão
([you might not need an effect](https://react.dev/learn/you-might-not-need-an-effect)):

1. `editing` e `draft` eram dois estados para um só conceito, mantidos em
   sincronia por um `useEffect` que reescrevia o rascunho a cada mudança de
   prop. Além de cascatear renders, permitia o estado inválido "editando com
   rascunho velho". Viraram um único `draft: Draft | null`, onde `null`
   significa "não editando" — o efeito deixou de existir.
2. O estado de carregamento da imagem era resetado por `useEffect` quando a URL
   mudava. Passou a carregar a própria URL (`imageState.url`) e a se ajustar
   **durante a renderização**, que é o padrão documentado pelo React para
   "resetar estado quando uma prop muda".

Nenhuma regra foi desativada para acomodar o código. A única exceção é
`react-refresh/only-export-components` em `src/pages/`, e por um motivo
concreto: aqueles arquivos são pontos de entrada que montam no DOM, não módulos
importáveis, então Fast Refresh não se aplica a eles.

**Licença.** MIT. Sem licença, um repositório público é legalmente
inutilizável por terceiros — o padrão do direito autoral é "todos os direitos
reservados".

### Etapa 16 — Gargalos fora do JavaScript

Varredura nas camadas que as análises de React não cobrem: rede, cache HTTP,
CSS/renderização e o protocolo do próprio Owlbear.

**Aplicado**

| O quê | Por quê |
|---|---|
| `preconnect` para `images.owlbear.rodeo` em `index.html` e `pages/handout.html` | As imagens vêm de outra origem. Sem isso, a primeira miniatura paga DNS + TCP + TLS antes de começar a baixar |
| `public/_headers` com política de cache | Ver abaixo — o `manifest.json` é o caso crítico |
| Barra de orçamento anima com `transform: scaleX()` em vez de `width` | Animar `width` força recálculo de layout a cada quadro (60/s durante a transição); `transform` só recompõe |

**O `_headers` e por que o `manifest.json` é crítico**

O `manifest.json` é o endereço que o Owlbear guarda para a extensão. Cacheado
com agressividade, quem já instalou **nunca recebe atualização** — e o sintoma
seria "publiquei e nada mudou", difícil de diagnosticar. Ficou `no-cache`.

Os arquivos em `/assets/` carregam hash do conteúdo no nome, então são
`immutable` com um ano de validade, sem risco. O HTML não tem hash: precisa
revalidar para apontar aos assets novos.

O `manifest.json` também recebe `Access-Control-Allow-Origin: *`
explicitamente. Não consegui determinar de forma conclusiva se o Cloudflare
Pages já manda esse cabeçalho por padrão — e é exatamente por isso que ele está
declarado. Sem ele, produção repetiria o `NetworkError` do B9, com o agravante
de só aparecer depois do deploy.

**Verificado e já ótimo**

- **Fontes:** nenhuma fonte web. A pilha é `system-ui, -apple-system, "Segoe UI",
  Roboto, sans-serif` — zero download, zero *flash* de texto.
- **CSS:** 16 kB no total, sem `filter`, `backdrop-filter` nem `will-change`.
- **`modulepreload`:** o Vite já emite para os chunks compartilhados.

**Custo real numa mesa de 4 pessoas**

| Momento | Download |
|---|---|
| Cada cliente ao entrar na sala (só o background) | **57 kB** |
| Ao abrir o journal (só quem abrir) | +217 kB |
| 4 clientes entrando, ninguém abrindo nada | 231 kB no total |

**Limitação sem saída: o SDK não é tree-shakeable**

`@owlbear-rodeo/sdk` exporta um único objeto `OBR` com todas as APIs já
instanciadas como propriedades. Carregamos `scene`, `tool`, `contextMenu`,
`interaction`, `notification`, `modal`, `theme`, `fog`, `grid` e `history` sem
usar nenhuma. É a maior parte dos 57 kB que **todo cliente da sala** baixa.
Só um fork do SDK resolveria — desproporcional.

**Avaliado e NÃO feito**

| Ideia | Por quê não |
|---|---|
| `content-visibility: auto` nas linhas da lista | Ganho marginal com `n` ≤ 53 e traz o risco de salto de rolagem se o `contain-intrinsic-size` errar |
| `srcset` por densidade de tela nas miniaturas | Pedimos 64 px (2× de 32). Numa tela 1× isso são 10 kB "a mais" — complexidade sem ganho |
| Cortar o read-before-write das escritas | São dois trajetos de IPC por gravação, mas só em ação explícita do usuário. O read é o que protege contra sobrescrever outro cliente |

### Etapa 15 — Redimensionamento pelo CDN (o maior ganho do projeto)

A hipótese da Etapa 14 foi verificada com uma URL real do CDN, e ela vale.

**O parâmetro é `width`, não `w`.** Medido com uma imagem de 256×256:

| Parâmetro | HTTP | Bytes | Dimensões reais |
|---|---|---|---|
| (nenhum) | 200 | 84 kB | 256×256 |
| **`?width=64`** | 200 | 10 kB | **64×64** ✅ |
| `?width=128` | 200 | 32 kB | 128×128 ✅ |
| `?height=64` | 200 | 10 kB | 64×64 ✅ |
| `?w=64` | 200 | 84 kB | 256×256 — ignorado |
| `&w=64` | **400** | — | erro |
| `?width=1200` | 200 | 84 kB | 256×256 — **não amplia** ✅ |

O CDN redimensiona de verdade, não recomprime; e não amplia quando o pedido é
maior que o original. Os dois comportamentos são os desejados.

**Aplicado**

- Miniaturas da lista: `?width=64` (aparecem com 32 px de CSS; 64 cobre telas
  de densidade dupla)
- Imagem do modal: `?width=1200` (o card tem no máximo 600 px)
- Zoom: URL original, porque aí o ponto é ver em resolução cheia

`resizedImageUrl` só reescreve URLs de `images.owlbear.rodeo`. Endereços de
outros domínios voltam intactos — o mestre pode colar uma URL de qualquer
lugar, e acrescentar `?width=` numa URL alheia iria de inócuo a quebrar a
imagem.

**Ganho medido**

| Imagem | Antes | Miniatura | Modal |
|---|---|---|---|
| 256×256 | 0,3 MB | 0,016 MB (16×) | 0,3 MB |
| 1024×1024 | 4 MB | 0,016 MB (256×) | 4 MB |
| 2048×2048 | 16 MB | 0,016 MB (**1024×**) | 5,5 MB (3×) |
| 4096×4096 | 64 MB | 0,016 MB (**4096×**) | 5,5 MB (12×) |

Uma lista com 20 ilustrações de 2048×2048: **320 MB → 0,3 MB**.

É, com folga, a maior otimização do projeto — três ordens de grandeza, contra
os kilobytes que qualquer ajuste de JavaScript renderia.

Testes: 63 → 68.

### Etapa 14 — Memória: onde ela realmente está

Avaliação das técnicas clássicas de performance em React contra a forma **deste**
app. A conclusão é que a maioria não se aplica, e a que se aplica não é código
JavaScript.

**Medição do bundle**

| Chunk | Peso | O que é |
|---|---|---|
| `global` | 148 kB | **`react-dom` sozinho é 132 kB** |
| `client` | 57 kB | SDK do Owlbear |
| nosso código | 24 kB | as duas páginas somadas |
| 12 ícones lucide | ~4 kB | irrelevante |

**Custo de memória de uma imagem decodificada** (largura × altura × 4 bytes,
independente do tamanho do arquivo e do tamanho exibido):

| Imagem | Memória |
|---|---|
| token 256×256 | 0,3 MB |
| retrato 1024×1024 | 4 MB |
| ilustração 2048×2048 | 16 MB |
| mapa 4096×4096 | 64 MB |

20 ilustrações na lista = **320 MB**, ou **1475× o bundle JS inteiro**.

Em memória, este app é imagem. O resto é ruído.

**Veredito por técnica**

| Técnica | Aplicável? |
|---|---|
| Code splitting / lazy loading | **Já no máximo.** A divisão por página faz o `background` carregar 57 kB em vez de 217 kB — sem React nem lucide. Dentro das páginas sobram 24 kB de código nosso; dividir mais custaria um estado de carregamento para poupar kilobytes |
| Virtualização de listas | **Não.** `n` ≤ 53 pelo orçamento de metadata; virtualizar 53 linhas é biblioteca e complexidade para nada |
| Otimização de imagens | **Sim — é o único lever grande.** `loading="lazy"` e `decoding="async"` já aplicados. O passo que falta depende de o CDN do Owlbear aceitar redimensionamento por parâmetro (não verificado; ver P6) |
| Evitar renders desnecessários | **Feito na Etapa 13** — curto-circuito nas mudanças de metadata |
| Cache de API | **Não se aplica.** A metadata é push via `onMetadataChange`, sem polling. O `getMetadata` antes de cada escrita é deliberado, para concorrência |
| Manter estado local | Estado já é mínimo |
| Debounce / throttle | **Feito.** O `ResizeObserver` disparava várias vezes por layout, cada disparo custando duas chamadas de IPC (`setWidth` + `setHeight`). Agrupado por quadro de animação: uma rajada de 30 disparos vira 1 envio |
| `React.memo`, `useMemo`, `useCallback` | Sem problema medido. O `useMemo` que importava (orçamento) já foi tratado |

**Decisão registrada: NÃO guardar as dimensões da imagem**

`ImageContent` do SDK traz `width` e `height` reais, e nós os descartamos de
propósito. Guardá-los custaria ~20 B por handout — 10% do orçamento de 10 kB —
para evitar apenas um salto de layout, que já é mitigado por só reportar o
tamanho depois de `onLoad`.

### Etapa 13 — Eficiência

Três ganhos reais. O resto foi deliberadamente **não** feito (ver abaixo).

**1. Curto-circuito nas mudanças de metadata** (o maior)

`OBR.room.onMetadataChange` dispara para qualquer mudança na sala, vinda de
qualquer extensão. Reparseávamos a lista inteira sempre — criando um array
novo, invalidando os `useMemo` a jusante (filtro de visibilidade e
`checkBudget`, que roda `JSON.stringify`) e re-renderizando a árvore.

Agora comparamos a serialização da NOSSA fatia e só aplicamos se mudou.

Medido com 2000 eventos vindos de outra extensão e 40 handouts nossos:
67 ms → 31 ms de parse. O ganho de CPU é modesto em absoluto (33 µs → 15 µs por
evento); **o ganho real são os 1999 re-renders evitados**, que o benchmark não
mede.

**2. União discriminada para as confirmações**

`pendingImport` e `pendingRemove` eram estados independentes: bastava escolher
um arquivo e clicar na lixeira para ver duas barras de confirmação empilhadas.
Viraram uma união (`{kind: "none" | "import" | "remove"}`) — o estado inválido
deixou de existir por construção.

**3. Orçamento não é calculado no cliente do jogador**

Só o mestre escreve e só ele vê a barra. Para um jogador era um
`JSON.stringify` da lista inteira a cada mudança, para um número que ninguém lê.
Passou a usar `EMPTY_BUDGET`.

**O que foi avaliado e NÃO feito**

| Ideia | Por que não |
|---|---|
| `Map` no lugar da varredura linear | `n` ≤ 53 por causa do próprio orçamento; otimizar um laço de 53 elementos é complexidade sem ganho |
| `React.memo` nos componentes | Sem problema de re-render medido; com o item 1, ficou mais raro ainda |
| Preact no lugar de React | Cortaria ~130 kB, mas é troca grande para um ganho que ninguém reclamou |
| `zod` no lugar dos type guards | ~13 kB gzipped para três formas pequenas e estáveis |
| `flatMap` no lugar de `map().filter()` | Perde o estreitamento de tipo do TypeScript sem ganho mensurável |

Testes: 61 → 63.

### Etapa 12 — Varredura final

**Bugs de perda silenciosa** (B17–B19) — todos no caminho de erro, que é onde
ninguém olha. O `guard` de `useHandouts` engolia a exceção e devolvia `void`,
então quem chamava não tinha como saber se gravou. Agora devolve `boolean` e
os três pontos de decisão respeitam o retorno.

**Organização** — `handout.html` e `background.html` foram para `pages/`.
`index.html` fica na raiz porque o manifest aponta a action para `"/"`. O Vite
preserva a estrutura no `dist`, então as URLs viraram `/pages/*.html`;
`manifest.json` e `client.ts` foram atualizados juntos.

**Teste novo de manifest** (`manifest.test.ts`) — o `manifest.json` aponta para
arquivos por caminho, em texto solto: um caminho errado não quebra compilação
nem build, quebra em runtime dentro do Owlbear, em silêncio. O teste amarra
cada caminho a um arquivo real e confere os limites de tamanho de `name` e
`description` e os nomes de permissão. Validado por mutação: quebrando o
`background_url` de propósito, o teste falha.

**Também nesta etapa:** `Esc` fecha a janela (e, em edição, primeiro cancela a
edição, para não descartar o texto digitado); excluir passou a pedir
confirmação, dizendo se perde anotações e se some da tela dos jogadores.

Testes: 45 → 61.

### Etapa 11 — Correção da família de bugs de realimentação

O auto-resize da Etapa 9 introduziu uma classe inteira de bugs: **qualquer
medida do card que dependa do iframe realimenta**, porque é o card que define o
tamanho do iframe. Três ocorrências, ver B14–B16.

A regra que ficou: dentro do popover do handout, **nenhuma medida do card pode
vir de `vh`, `vw` ou porcentagem do container**. Os tetos vêm de
`OBR.viewport`, a janela real do Owlbear, e entram por `style` inline.

Corrigidos junto: imagem quebrada agora tem mensagem em vez de sumir em
silêncio, e o resize só é reportado depois que a imagem carrega (evitava o
salto de "talo" para tamanho final).

### Etapa 10 — Varredura de código morto e gargalos

**Código morto encontrado e removido**

- `readFileAsText` (`backup.ts`) — substituído por `file.text()` e esquecido.
- `ROOM_METADATA_LIMIT` estava declarado e nunca usado. Em vez de apagar, passou
  a **derivar** `OUR_METADATA_BUDGET`: a relação "reservamos 10 dos 16 kB" virou
  código em vez de dois números soltos.
- `byteSize` e `WARN_THRESHOLD` deixaram de ser exportados (uso interno).

**Limpo na varredura** — nenhuma classe CSS órfã, nenhuma dependência declarada
e não importada, nenhum arquivo órfão, nenhum `useState` sem leitura, nenhuma
prop declarada e não usada.

**Dois problemas reais achados no caminho**

1. **Realimentação no redimensionamento.** O card usava
   `min-width: min(340px, 100%)`, que depende da largura do iframe — e é o
   iframe que o `ResizeObserver` redimensiona a partir do card. Dependência
   circular oscila. Passou a `min-width: 340px` fixo.
2. **`version` do backup era decorativa.** Era gravada na exportação e nunca
   conferida na importação: um arquivo de formato mais novo entraria em
   silêncio. Agora a leitura recusa versão superior à suportada.

**Gargalos: nenhum encontrado.** Não há ORM nem banco — a persistência é a
metadata da sala, limitada a 16 kB por construção. Medições em
[§6](#6-estado-de-verificação).

Testes: 30 → 45, cobrindo agora `limits.ts` e `backup.ts`.

### Etapa 9 — Confirmação de importação e janela ajustada ao conteúdo

- **Importar** passou a exigir confirmação, dizendo quantos handouts entram,
  quantos serão substituídos e se algum dos atuais está liberado para os
  jogadores. Antes substituía tudo direto, sem desfazer.
- O card passou a usar `width: fit-content` em vez de esticar até 600 px
  sempre, e o popover é redimensionado por `ResizeObserver` +
  `OBR.popover.setWidth/setHeight`. Além do visual, isso resolve um problema
  real: o excedente do popover é um iframe **transparente** que interceptava
  cliques destinados ao mapa.

### Etapa 8 — Suporte a túnel para teste multi-aparelho

`server.allowedHosts` no `vite.config.ts` passou a aceitar domínios de ngrok,
Cloudflare Tunnel e localtunnel. Sem isso o Vite 6 recusa o `Host` do túnel
(defesa contra DNS rebinding). Verificado: túnel passa, `localhost` continua,
CORS do Owlbear intacto, host desconhecido segue bloqueado.

### Etapa 7 — Organização em camadas e endurecimento

Reestruturação de `src/` em três camadas, com README próprio em `core/` e `ui/`.

```
antes                          depois
src/components/   →            src/ui/
src/obr/          →            src/core/domain/   (puro)
                               src/core/owlbear/  (SDK)
src/*.tsx (raiz)  →            src/pages/
```

A regra `domain/ ← owlbear/ ← pages/ → ui/` passou a ser **verificada por
teste** (`core/domain/architecture.test.ts`). O teste pegou duas violações
imediatamente — uma no código (`backup.ts` importava de `owlbear/constants.ts`;
a constante foi movida para o domínio) e uma no próprio teste, que proibia a
`ui/` de importar utilitários puros, restrição mais rígida que a necessária.

Segurança endurecida nesta etapa: ver B12 e B13. Testes: 8 → 30.

---

## 5. Bugs encontrados e corrigidos

| # | Sintoma | Causa raiz | Correção |
|---|---|---|---|
| B1 | Card branco dentro de um card escuro | `hidePaper` não usado — o Owlbear desenha o próprio "paper" | `hidePaper: true` |
| B2 | Handout fechava ao clicar no mapa | `disableClickAway` não usado | `disableClickAway: true` |
| B3 | Popover colava no canto da tela | Sem âncora explícita | Âncora no centro via `OBR.viewport.getWidth/getHeight` |
| B4 | **Jogador via a lista inteira do mestre** | Nenhum filtro por papel | Filtro em `useHandouts` + `toPlayerHandout` |
| B5 | Sem descrição nem notas | Modelo era só `{id, title, imageUrl}` | Campos adicionados, exclusivos do mestre |
| B6 | Sem "retirar" e sem backup | Não implementados | Canal `REVOKE_CHANNEL` + `core/domain/backup.ts` |
| B7 | Listeners duplicados | `handout.tsx` montava o hook 2× | Uma assinatura só |
| B8 | Piscava "Handout indisponível" no jogador | Corrida: broadcast chega antes da metadata | Primeiro uma carência de 2 s; na Etapa 4 a corrida **deixou de existir** — a URL do popover passou a carregar imagem e título, então a janela desenha sem depender da metadata. A carência foi removida por ser desnecessária. |
| B9 | *"NetworkError when attempting to fetch resource"* ao instalar | **Vite 6 restringiu CORS à mesma origem** (correção da CVE-2025-24010). Resposta 200 sem `Access-Control-Allow-Origin` | `vite.config.ts`: libera só `owlbear.app` e `owlbear.rodeo`, por regex |
| B10 | Texto da seção do mestre transparente **por cima** da imagem | Compressão do flexbox: `.body` e `.gmSection` podiam encolher num container com `max-height` | `flex: 0 0 auto` nos filhos + fundo próprio na `.gmSection` |
| B11 | Imagem borrada | `width: 100%` ampliava um token de ~256 px até 600 px | `max-width: 100%` — nunca amplia; zoom passou a ser o "ampliar de propósito" |
| B12 | **Qualquer participante da sala podia forjar um broadcast** e abrir imagem arbitrária na tela de todos, ou fechar o handout que o mestre apresentava | O SDK não restringe quem emite num canal; validávamos só a *forma* do payload, não o emissor | `isFromGM(event.connectionId)` via `OBR.party.getPlayers()`; na dúvida, não obedece |
| B13 | URL de imagem aceita sem validação de esquema em 3 fronteiras (edição, importação, broadcast) | Nenhuma validação | `core/domain/url.ts` — só `http:` e `https:`; aplicado em `parseHandout`, nos type guards e na query string do popover |
| B14 | **Janela cortada num talo, imagem sumindo** | `max-height: 80vh` no card. Dentro do popover, `vh` mede o próprio iframe — que o auto-resize encolhe a partir do card. Antes da imagem carregar o card tinha ~40 px, o popover ia a 64 px, o teto virava 51 px, e a imagem não cabia mais. Espiral de morte | Teto vem de `OBR.viewport` (tela real) por `style` inline; `vh` proibido no card |
| B15 | Card crescendo sem parar no zoom | `.modal.zoomed { width: 100% }` media o iframe; o resize definia o iframe como card + 24 px. Os dois se perseguiam, +24 px por ciclo | No zoom a largura vem do teto absoluto da tela real |
| B16 | Janela "saltava" ao abrir | O resize era reportado antes da imagem carregar, quando o card tinha só o cabeçalho | Só reporta depois de `onLoad`/`onError` da imagem |
| B17 | **Broadcast saía mesmo com a gravação falhando** | `saveHandout` engolia o erro e devolvia `void`; o "liberar" emitia assim mesmo. O jogador via o handout na tela sem ele estar na lista, e ao fechar perdia o acesso sem entender | Mutações devolvem `boolean`; sem gravar, não emite |
| B18 | **Texto digitado sumia ao falhar o salvamento** | `handleSave` sempre saía do modo de edição; o rascunho era resetado pelas props. Aparecia a mensagem de erro e o trabalho ia junto | Só sai da edição se gravou |
| B19 | Excluir um handout liberado não fechava na tela do jogador | O "Retirar" emitia o broadcast de fechar; o excluir não | Excluir emite o mesmo broadcast quando o handout estava liberado |
| B21 | **"Retirar" não fechava a janela que o jogador abriu sozinho** | O `openImageUrl` do background só era preenchido por broadcast de "mostrar". Um jogador que abrisse um handout pela própria lista — o caso de quem entra no meio da sessão e encontra a lista cheia — ficava invisível para o background, e a condição de guarda barrava o fechamento | O "retirar" passou a ser ouvido **dentro da janela** (`onHandoutRevoked`), que sempre sabe o que está mostrando. O background ficou só com o "mostrar" |
| B20 | **Tela em branco permanente se a leitura inicial falhasse** | `Promise.all([getMetadata, getRole])` sem `catch`: `loading` ficava `true` para sempre, sem mensagem e sem log | `catch` + `finally`; a falha de leitura aparece na mesma faixa de erro da escrita |

**Nota sobre B9:** os tutoriais oficiais do Owlbear foram escritos na era do
Vite 4/5, quando `cors: true` era o padrão. Por isso não mencionam nada disso —
e por isso o erro confunde: `curl` funciona, o servidor está no ar, e mesmo
assim o navegador recusa.

---

## 6. Estado de verificação

### Verificado por execução

| O quê | Comando | Resultado |
|---|---|---|
| Tipagem | `npx tsc --noEmit` | ✅ limpa |
| Build | `npm run build` | ✅ 3 bundles |
| Testes | `npm test` | ✅ 68 passando |
| CDN redimensiona (`?width=`) | medido com URL real | ✅ ver Etapa 15 |
| Manifest aponta para arquivos reais | `manifest.test.ts` | ✅ validado por mutação |
| Camadas respeitadas | `architecture.test.ts` | ✅ |
| Vulnerabilidades em produção | `npm audit --omit=dev` | ⚠️ 2 moderadas, sem correção disponível (ver abaixo) |
| CORS liberado para o Owlbear | `curl -H "Origin: https://owlbear.app" …` | ✅ `Access-Control-Allow-Origin` presente |
| CORS negado para terceiros | `curl -H "Origin: https://site-qualquer…" …` | ✅ sem cabeçalho |
| Entradas servidas | `curl` em `/`, `/handout.html`, `/background.html`, `/manifest.json` | ✅ HTTP 200 |
| Capacidade de armazenamento | script de medição | ✅ números da [§4](#4-histórico-do-que-foi-construído) |
| Peso por página | análise do `dist/` | ✅ tabela abaixo |

### Peso de cada página

| Página | Carrega | Total |
|---|---|---|
| `background.html` | SDK + script próprio | **57,6 kB** |
| `index.html` (journal) | SDK + React + lucide + CSS | 215,6 kB |
| `handout.html` | SDK + React + lucide + CSS | 215,6 kB |

O número que importa é o primeiro: a página de background roda num iframe
oculto em **todo cliente da sala**, e o Vite a manteve sem React e sem lucide.

As outras duas ficam em ~65 kB comprimidos, normal para React. Reduzir de
verdade exigiria trocar React por Preact (~10 kB) — mudança grande para ganho
que ninguém reclamou; registrado como opção, não como pendência.

### Verificado dentro do Owlbear

**Como mestre**

- ✅ Extensão instala e aparece na sala
- ✅ Biblioteca abre e a imagem escolhida renderiza na janela
- ✅ Seção "Só o mestre vê" aparece
- ✅ Edição de descrição e notas salva

**Como jogador** *(validado em segunda tela, 2026-08-31)*

- ✅ "Show to Players" abre a janela na tela do jogador
- ✅ O handout liberado fica na lista dele e pode ser reaberto
- ✅ A janela do jogador mostra **apenas** título e imagem
- ✅ Cabeçalho do jogador tem só zoom e fechar — sem "Show to Players", sem "Edit"
- ✅ A seção "Só o mestre vê" não é renderizada para o jogador
- ✅ "Retirar" tira da lista e fecha a janela do jogador
- ✅ **Poda confirmada em uso real**: um handout aberto da biblioteca, não
  liberado e sem anotação, não aparece nem na lista do mestre — não chega a
  ocupar metadata. Também não vaza para o jogador.
- ✅ Importar JSON funciona

### Vulnerabilidades de dependência

`npm audit` reporta 7 no total, mas a separação importa:

- **Produção (vai para o bundle):** 2 moderadas, ambas de `uuid` puxado pelo
  `@owlbear-rodeo/sdk`. *No fix available*. A falha é ausência de checagem de
  limites quando `buf` é passado em v3/v5/v6 — caminho que o nosso código não
  usa. Sem ação possível a não ser aguardar o SDK.
- **Desenvolvimento (não vai para o bundle):** as demais, incluindo a crítica e
  a alta, todas na cadeia `vite`/`vitest`. Não chegam ao usuário final.

### **Não** verificado

Em ordem de risco:

1. ❌ **Handout ANOTADO mas não liberado não pode aparecer para o jogador.**

   Há dois caminhos distintos pelos quais um handout some da vista do jogador,
   e são trechos de código diferentes:

   | Caminho | Situação | Estado |
   |---|---|---|
   | Poda (`isWorthStoring`) | não liberado, **sem** anotação | ✅ verificado |
   | **Filtro (`useHandouts`)** | não liberado, **com** anotação | ❌ **não verificado** |

   O segundo é o relevante para segurança: um handout anotado **existe** na
   metadata da sala, que o cliente do jogador recebe inteira. É o filtro que
   impede o vazamento. Regressão aqui reintroduz B4.

   *Como testar:* anotar um handout e **não** liberar. Ele passa a aparecer na
   lista do mestre (agora ocupa espaço); a lista do jogador deve continuar
   sem ele.
2. ❌ **Clique no mapa não pode fechar a janela do jogador** (`disableClickAway`,
   B2). Se falhar, o mestre perde o controle do que está na tela.
3. ❌ **Reabrir da biblioteca uma imagem já anotada devolve as anotações** (D2,
   identidade pela URL). Se falhar, perde-se anotação a cada reabertura.
4. ❌ **Exportar** dentro do iframe — o download pode ser bloqueado pelo
   sandbox; há fallback de textarea + "Copiar", também não testado.
   (Importar já foi verificado.)
5. ❌ Comportamento ao estourar o orçamento de metadata.
6. ❌ B12 na prática: um jogador forjando um broadcast deve ser ignorado.
   Testável pelo console do cliente do jogador.
7. ❌ Zoom depois de B15: ampliar deve parar no teto da tela, sem crescer em
   ciclo.
8. ❌ Imagem com URL quebrada deve mostrar a mensagem nova, não sumir.
9. ❌ Caminho de erro na prática: com o orçamento estourado, o "liberar" não
   pode emitir broadcast e o "salvar" não pode perder o texto digitado (B17,
   B18).

---

## 7. Trabalho pendente

### P1 — Testar o fluxo do jogador *(prioridade máxima)*

**Como montar o ambiente.** O jogador não instala nada: a lista de extensões
pertence à sala, e o cliente dele carrega sozinho ao entrar (confirmado na
prática — um celular que só entrou pelo convite já tentou carregar a extensão).
O requisito é a URL do manifest ser alcançável do aparelho dele.

- **Mesma máquina** *(suficiente para este roteiro)*: duas janelas do
  navegador, uma normal como mestre e uma anônima como jogador. Ambas resolvem
  `localhost` para o mesmo servidor. Zero configuração.
- **Outro aparelho**: `localhost` aponta para o próprio aparelho. O IP da rede
  local **não resolve** — `http://192.168.x.x` é bloqueado como conteúdo misto
  numa página HTTPS; só `localhost` e `127.0.0.1` são origens confiáveis. A
  porta é irrelevante. A saída é um túnel HTTPS (`ngrok http 5173`), já
  contemplado em `server.allowedHosts` no `vite.config.ts`.

Roteiro:

1. Mestre: Biblioteca → escolhe imagem → janela abre centralizada
2. Mestre: Edit → preenche descrição e notas → Save
3. **Jogador: abre o caderninho → deve estar vazio** ← se aparecer algo, B4 voltou
4. Mestre: Show to Players → janela abre na tela do jogador
5. **Jogador: confere que vê só título e imagem**, sem descrição nem notas
6. Jogador: clica no mapa → a janela **não** pode fechar
7. Mestre: Retirar → a janela do jogador fecha na hora e some da lista dele
8. Mestre: Exportar → baixa o JSON (ou cai no fallback de copiar)

### P2 — Publicar

Enquanto viver em `localhost`, a extensão só funciona na máquina do
desenvolvedor com o servidor rodando. Confirmado na prática: no celular o
Owlbear responde *"Não foi possível carregar a extensão: localhost"*, porque
`localhost` no celular é o próprio celular.

**Restrição que decide o host:** 5 caminhos absolutos a partir da raiz —
`/logo.svg`, `/icon.svg`, `/` e `/pages/background.html` no `manifest.json`, e
`/pages/handout.html` em `core/owlbear/client.ts`. Um host que sirva em
subpasta quebra todos.

| Host | Endereço | Raiz? | Custo |
|---|---|---|---|
| **Cloudflare Pages** *(recomendado)* | `projeto.pages.dev` | ✅ | grátis, banda ilimitada, sem cartão |
| Netlify | `projeto.netlify.app` | ✅ | grátis, 100 GB/mês |
| Vercel | `projeto.vercel.app` | ✅ | grátis (hobby) |
| GitHub Pages | `usuario.github.io/repo/` | ❌ subpasta | grátis, mas exige `base` no Vite e caminhos relativos |

Passos: `git init` e subir para o GitHub → conectar no Cloudflare Pages → build
`npm run build`, saída `dist` → link de instalação vira
`https://algo.pages.dev/manifest.json`.

Depois do deploy, os jogadores não precisam de nada rodando: o endereço é
permanente e funciona com o computador do mestre desligado.

### ~~P3 — Inicializar o Git~~ ✅ concluído

Repositório público em
[kadugaviao/handouts_owlbear_extension](https://github.com/kadugaviao/handouts_owlbear_extension),
com histórico em Conventional Commits. Commits configurados com o e-mail de
encaminhamento do GitHub, para não expor o endereço pessoal.

### P4 — Journal do jogador *(adiado, R13)*

Jogador criar handouts próprios com imagem e anotações. Dobra a superfície:
exige dono por handout, listas separadas, e o mesmo aviso de privacidade de D4
vale (outro jogador com DevTools leria).

### P5 — Melhorias menores identificadas

- A janela mantém 600 px de largura mesmo com imagem pequena — um token fica
  centralizado com bastante espaço branco em volta. Encolher o card até a
  largura da imagem é uma opção.
- Acessibilidade do modal: o foco ainda não fica preso dentro dele (`Esc` já fecha).
- Sem lint configurado (ESLint + Prettier).
- Sem CI — os testes e o build rodam só localmente.

---

## 8. Ideias descartadas e por quê

### Pasta local no computador do mestre

*Ideia:* a extensão criaria uma pasta "handout owlbear" e leria as imagens dali.

**Descartada por dois motivos independentes, qualquer um deles fatal:**

1. **O navegador proíbe.** A extensão roda em iframe de origem diferente dentro
   do `owlbear.app` (C11). A [especificação do File System Access](https://wicg.github.io/file-system-access/)
   é explícita: em contexto de terceiros, sites não podem obter acesso a
   arquivos ou pastas novos. `showDirectoryPicker()` é bloqueado.
2. **Arquivo local não chega ao jogador.** Vira `blob:`, que existe só naquele
   navegador. O jogador receberia link morto.

*O que sobreviveu da ideia:* o instinto de "não duplicar, puxar de uma
biblioteca que já existe" estava certo — só apontado para o lugar errado. Essa
biblioteca é o gerenciador de imagens do próprio Owlbear (D1, D3).

### `localStorage` para o conteúdo do mestre

Ver D4. Perde na troca de máquina e **perde tudo no deploy** (origem diferente).

### `cors: true` no Vite

Resolveria B9 numa linha, mas deixaria qualquer página que o desenvolvedor
visite ler o código-fonte do projeto pelo servidor de desenvolvimento (D9).
