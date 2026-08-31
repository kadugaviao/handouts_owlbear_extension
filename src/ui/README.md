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

## Duas armadilhas de CSS que já morderam

Estão documentadas em comentário no próprio CSS. Vale conhecer antes de mexer.

### `flex: 0 0 auto` nos filhos do modal

O `.modal` é um flex column com `max-height: 80vh`. Com o padrão
(`flex: 0 1 auto`) o flexbox **comprime** os filhos quando o conteúdo passa da
altura máxima, e o conteúdo vaza por cima do irmão de baixo — o texto das notas
aparecia transparente sobre a imagem.

Num container que rola, os filhos ficam no tamanho natural e quem rola é o
container.

### `max-width`, nunca `width: 100%` na imagem

Tokens do Owlbear são pequenos — 256 px é comum. `width: 100%` os estica até os
600 px do modal e o navegador interpola: fica borrado.

`max-width: 100%` encolhe o que é grande e **nunca amplia** o que é pequeno. O
botão de zoom é quem amplia de propósito, com `min-width: 100%`.

## Acessibilidade

O que já está feito: `aria-label` nos botões só-de-ícone, `aria-pressed` no
zoom, `<label>` associado a cada campo, `alt` nas imagens (vazio nas miniaturas
decorativas da lista, com o título na imagem do modal).

O que falta: foco não fica preso dentro do modal, e `Esc` não fecha.
