# `core/` — dados, regras e integração

Esta é a camada que o pedido chamou de "back". **Não existe servidor neste
projeto** — a extensão é 100% client-side. O que existe é uma separação de
responsabilidades: aqui moram os dados, as regras e a conversa com o Owlbear.
Nada de React.

## Regra de dependência

```
domain/  ←  owlbear/  ←  pages/  →  ui/
 (puro)      (SDK)      (junta)   (React)
```

A seta aponta para quem é importado. **Nunca inverta.**

- `domain/` não importa nada — nem o SDK, nem React.
- `owlbear/` importa `domain/`.
- `ui/` não importa nem `domain/` nem `owlbear/`, exceto tipos.

Quem quebra essa regra transforma código testável em código que precisa de
mock.

## `domain/` — lógica pura

Sem SDK e sem React, então testa sem nenhum mock.

| Arquivo | O que faz |
|---|---|
| `handout.ts` | O modelo de dados e as duas regras que sustentam o projeto: `isWorthStoring` (a poda) e `toPlayerHandout` (o corte de visibilidade) |
| `limits.ts` | Orçamento dos 16 kB de metadata da sala |
| `backup.ts` | Serializar e ler o JSON de backup |
| `url.ts` | Validação de esquema de URL (barreira contra `javascript:` e `data:`) e `resizedImageUrl`, que pede ao CDN do Owlbear a imagem já no tamanho exibido |

### As duas regras que importam

**`isWorthStoring`** — um handout que não está liberado e não tem anotação já é
integralmente descrito pela biblioteca de imagens do Owlbear. Guardar de novo
seria desperdiçar orçamento. Por isso ele é podado, e por isso a biblioteca é
efetivamente ilimitada.

**`toPlayerHandout`** — zera `description` e `notes`. É aplicado em
`useHandouts` antes de qualquer componente ver os dados, então um cliente de
jogador nunca chega a segurar esses campos.

## `owlbear/` — a única camada que fala com o SDK

| Arquivo | O que faz |
|---|---|
| `constants.ts` | IDs da extensão, canais e chaves de metadata |
| `client.ts` | Popover, broadcast e biblioteca de imagens |
| `useHandouts.ts` | Persistência na metadata + filtro de visibilidade + orçamento |
| `mount.ts` | Bootstrap com checagem de `OBR.isAvailable` |

Todo import de `@owlbear-rodeo/sdk` está aqui. Isso é o que mantém `ui/`
testável e reutilizável.

## Segurança

Não há senha, sessão nem banco — logo, nada de `bcrypt`. As ameaças reais são
outras, e todas vêm de **fronteiras de dados não confiáveis**.

### As três fronteiras

| Fronteira | Quem controla | Defesa |
|---|---|---|
| Campo de edição | o mestre | `isSafeImageUrl` em `parseHandout` |
| Importação de backup | arquivo de origem desconhecida | `isSafeImageUrl` em `parseHandout` |
| **Broadcast** | **qualquer um na sala** | esquema **+ emissor precisa ser mestre** |

### O broadcast era o buraco

O SDK do Owlbear **não restringe quem emite num canal**. Sem defesa, qualquer
participante poderia forjar um "mostrar" e abrir uma imagem arbitrária na tela
de todo mundo, ou forjar um "retirar" e fechar o handout que o mestre acabou de
apresentar.

Duas barreiras, em `client.ts`:

1. `isSharePayload` / `isRevokePayload` validam o **esquema da URL**.
2. `isFromGM(event.connectionId)` confere em `OBR.party.getPlayers()` se o
   emissor é mestre. Na dúvida (erro na consulta), **não obedece**.

### O que continua sendo limitação, não bug

O filtro de visibilidade é de **interface**. O Owlbear não oferece
armazenamento privado: `Permission` não cobre metadata e `Player.metadata` vaza
via `OBR.party.getPlayers()`. Um jogador com DevTools consegue ler a metadata da
sala. É o mesmo modelo do Roll20. Detalhes em `documents/spec.md`, decisão D4.

### Validação: por que não `zod`

As três formas validadas aqui são pequenas e estáveis, e os type guards à mão
ocupam ~30 linhas com mensagens específicas. `zod` custaria ~13 kB gzipped num
bundle que roda dentro de um iframe. Se o modelo crescer ou surgirem formas
aninhadas, a conta inverte — aí vale trocar.

## Desempenho

| Operação | Complexidade | Comentário |
|---|---|---|
| `readHandouts` | O(n) | só quando a **nossa** fatia da metadata muda |
| `findByUrl` | O(n) | varredura linear |
| `mutateHandouts` | O(n) | lê do servidor antes de escrever |
| `checkBudget` | O(n) | `JSON.stringify`; **não roda no cliente do jogador** |

**n é limitado pelo próprio orçamento**: no máximo ~53 handouts cabem em 10 kB.
Trocar a varredura por um `Map` seria otimizar um laço de 53 elementos —
complexidade a mais sem ganho mensurável.

### Três decisões que valem conhecer

**`onMetadataChange` dispara para a sala inteira**, de qualquer extensão. Um
rastreador de iniciativa escrevendo a cada turno nos faria reparsear a lista,
criar array novo, invalidar os `useMemo` e re-renderizar a árvore — para chegar
ao mesmo resultado. Por isso comparamos a serialização da nossa fatia antes de
aplicar.

**O orçamento não é calculado no cliente do jogador** (`EMPTY_BUDGET`). Só o
mestre escreve e só ele vê a barra; medir seria um `JSON.stringify` da lista
inteira para um número que ninguém lê.

**O read-before-write em `mutateHandouts`** é uma ida à rede por escrita, e é
deliberado: `setMetadata` substitui o valor da nossa chave por inteiro, e partir
do estado local apagaria o que outro cliente acabou de gravar.

## O que não dá para otimizar

`@owlbear-rodeo/sdk` exporta um único objeto `OBR` com todas as APIs já
instanciadas como propriedades — **não é tree-shakeable**. Carregamos `scene`,
`tool`, `contextMenu`, `interaction`, `notification`, `modal`, `theme`, `fog`,
`grid` e `history` sem usar nenhuma. São a maior parte dos 57 kB que todo
cliente da sala baixa ao entrar. Só um fork do SDK resolveria.
