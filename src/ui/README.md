# `ui/` — a interface

Componentes React puros. Esta é a camada que o pedido chamou de "front".

## A regra que define esta pasta

**Nada aqui importa `@owlbear-rodeo/sdk`.**

Tudo que toca a rede chega por *callback*, vindo de `core/owlbear/`. É isso que
permite abrir o `HandoutModal` num teste ou num Storybook sem ter um Owlbear
rodando, e é isso que separa "como aparece" de "o que acontece".

```tsx
// ✅ o componente recebe o que fazer
<HandoutModal onToggleShare={...} onClose={...} />

// ❌ nunca aqui
import OBR from "@owlbear-rodeo/sdk";
```

De `core/` a `ui/` pode importar **tipos** e **utilitários puros** (como
`formatBytes`). O que ela nunca alcança é `core/owlbear/` — a camada de
integração. Essa é a fronteira que o teste `architecture.test.ts` protege.

## Componentes

| Arquivo | O que é |
|---|---|
| `HandoutModal.tsx` | A janela flutuante estilo Roll20 |
| `HandoutList.tsx` | O caderninho, dentro do popover da action |
| `global.css` | Reset mínimo, compartilhado pelas três páginas |

Estilo em **CSS Modules** (`*.module.css`), um por componente. Sem framework:
a extensão roda num iframe e cada kilobyte conta.

## Três armadilhas que já morderam

Estão documentadas em comentário no próprio código. Vale conhecer antes de mexer.

### Nada de `vh`/`vw` no modal do handout

**A mais importante.** O popover é redimensionado a partir do card
(`ResizeObserver` → `OBR.popover.setWidth/setHeight`), e dentro dele `vh` mede
o **próprio iframe**. Qualquer medida do card em unidade de viewport vira
realimentação.

Já aconteceu duas vezes: um `max-height: 80vh` fazia a janela encolher a um
talo antes da imagem carregar e nunca mais crescer; um `width: 100%` no zoom
fazia card e iframe se perseguirem, crescendo 24 px por ciclo.

Os tetos vêm de `OBR.viewport` — a janela real do Owlbear — e entram por
`style` inline. Os valores no CSS (`max-width: 600px`, `max-height: 760px`) são
só o fallback do primeiro quadro.

### `flex: 0 0 auto` nos filhos do modal

O `.modal` é um flex column com altura máxima. Com o padrão (`flex: 0 1 auto`)
o flexbox **comprime** os filhos quando o conteúdo passa dela, e o conteúdo
vaza por cima do irmão de baixo — o texto das notas aparecia transparente sobre
a imagem.

Num container que rola, os filhos ficam no tamanho natural e quem rola é o
container.

### `max-width`, nunca `width: 100%` na imagem

Tokens do Owlbear são pequenos — 256 px é comum. `width: 100%` os estica até os
600 px do modal e o navegador interpola: fica borrado.

`max-width: 100%` encolhe o que é grande e **nunca amplia** o que é pequeno. O
zoom é quem amplia de propósito, com `min-width: 100%`.

## Imagens custam memória, não bytes

Uma imagem custa `largura × altura × 4 bytes` **decodificada** — independe do
tamanho do arquivo e do tamanho em que aparece. Uma ilustração de 2048×2048
ocupa 16 MB mesmo numa miniatura de 32 px.

Por isso todo `<img>` passa por `resizedImageUrl` (de `core/domain/url.ts`),
que pede ao CDN do Owlbear a imagem já redimensionada: miniaturas em 64 px, o
modal em 1200. O zoom usa a original, porque aí o ponto é ver em resolução
cheia.

## Estado: evite `useEffect` para derivar

Duas regras que o `eslint-plugin-react-hooks` protege, e que já foram violadas
aqui:

- **Um conceito, um estado.** `editing` e `draft` eram dois estados
  sincronizados por efeito. Hoje é `draft: Draft | null`, onde `null` significa
  "não está editando" — o estado inválido "editando com rascunho velho" deixou
  de ser representável.
- **Resetar estado quando uma prop muda** se faz *durante a renderização*, não
  em efeito. `imageState` carrega a URL que o originou e se ajusta quando ela
  muda. É o padrão que o [React documenta](https://react.dev/learn/you-might-not-need-an-effect).

## Acessibilidade

O que já está feito: `aria-label` nos botões só-de-ícone, `aria-pressed` no
zoom, `<label>` associado a cada campo, `alt` nas imagens (vazio nas miniaturas
decorativas da lista, com o título na imagem do modal).

`Esc` fecha a janela — e, em modo de edição, primeiro cancela a edição, para
não descartar o texto digitado sem aviso.

O que falta: o foco ainda não fica preso dentro do modal.
