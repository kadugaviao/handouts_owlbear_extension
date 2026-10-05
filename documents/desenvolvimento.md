# Desenvolvimento

Como rodar, como o projeto é organizado e as armadilhas conhecidas.

> Procurando **como usar a extensão**? Está no [`README.md`](../README.md).
> Procurando **por que as coisas são assim**? Está no [`spec.md`](spec.md).

---

## Rodar

```bash
npm install
npm run dev
```

Em [owlbear.app/profile](https://owlbear.app/profile), instale
`http://localhost:5173/manifest.json` e **remova essa entrada quando terminar** —
ela aponta para um servidor que só existe enquanto o `npm run dev` roda.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos + build de produção em `dist/` |
| `npm test` | Testes |
| `npm run lint` | ESLint |

O [CI](../.github/workflows/ci.yml) roda os três últimos a cada push, e depois
confirma que o commit chegou de fato à produção comparando o hash do bundle.

---

## Testar com dois clientes

O jogador **não instala nada**: a lista de extensões pertence à sala, e o
cliente dele carrega sozinho ao entrar.

- **Versão publicada:** duas janelas do navegador, uma normal (mestre) e uma
  anônima (jogador). O celular também funciona, sem configuração.
- **Versão local:** `localhost` só existe na sua máquina. Para alcançar outro
  aparelho é preciso um túnel HTTPS (`ngrok http 5173`) — o IP da rede local
  **não** serve, porque `http://192.168.x.x` é bloqueado como conteúdo misto
  numa página HTTPS. O `vite.config.ts` já aceita os domínios de ngrok,
  Cloudflare Tunnel e localtunnel em `allowedHosts`.

---

## Estrutura

```
index.html         entrada da action (o manifest aponta para "/")
pages/             páginas internas
├── handout.html     a janela flutuante
└── background.html  ouve o "mostrar", sempre vivo
src/
├── core/          dados, regras e integração — sem React
│   ├── domain/      lógica pura, testável sem mocks
│   └── owlbear/     única camada que fala com o SDK
├── ui/            componentes React — sem SDK
└── pages/         os scripts das três páginas
```

A regra de dependência é `domain/ ← owlbear/ ← pages/ → ui/`, e ela é
**verificada por teste** (`architecture.test.ts`), não só documentada. Ela já
foi violada na primeira oportunidade quando era só documentação.

| Onde | O quê |
|---|---|
| [`src/core/README.md`](../src/core/README.md) | Regras de dados, segurança e desempenho |
| [`src/ui/README.md`](../src/ui/README.md) | Componentes, CSS e armadilhas conhecidas |
| [`PROJETO.md`](../PROJETO.md) | Visão geral e estado |
| [`spec.md`](spec.md) | **Fonte da verdade**: histórico, decisões e bugs |
| [`design.md`](design.md) | **Fonte da verdade visual**: tokens, tema e refatoração |

---

## O orçamento de 16 kB

A metadata da sala **inteira** precisa caber em 16 kB, dividida com todas as
extensões instaladas. Reservamos 10 kB.

Por isso a biblioteca de imagens do Owlbear é a fonte, e a metadata guarda só o
que ela não sabe guardar:

| Situação do handout | Custo |
|---|---|
| Aberto da biblioteca, sem fixar, sem liberar, sem nota | **0 B** |
| Fixado ou liberado, sem anotação | 188 B |
| Anotado | 428 B – 1,4 kB |

Um handout que não é fixado, liberado nem anotado é **podado**: a biblioteca do
Owlbear já descreve tudo o que ele é.

---

## Privacidade: o que o modelo garante e o que não garante

O corte acontece na **camada de dados** (`visibleTo`), antes de qualquer
componente: o cliente do jogador nunca segura descrição ou notas em memória de
interface.

Mas a metadata da sala é legível por todos os clientes — o SDK do Owlbear não
oferece armazenamento privado. **Um jogador com DevTools consegue ler.** É o
mesmo modelo do Roll20. Ver a decisão **D4** no [`spec.md`](spec.md).

---

## Armadilhas conhecidas

### "NetworkError when attempting to fetch resource"

CORS no servidor de desenvolvimento. O **Vite restringe CORS à mesma origem por
padrão** desde a correção da CVE-2025-24010, e os tutoriais do Owlbear são da
era do Vite 4/5, quando `cors: true` era o padrão.

O `vite.config.ts` libera as origens do Owlbear — e **só** elas. Para conferir:

```bash
curl -i -H "Origin: https://owlbear.app" http://localhost:5173/manifest.json | head -3
# precisa aparecer: Access-Control-Allow-Origin: https://owlbear.app
```

Nunca use `cors: true`: qualquer página que você visitar passaria a poder ler o
código-fonte do projeto pelo servidor de desenvolvimento.

### Página em branco ao abrir `localhost:5173` direto

Esperado. A extensão precisa do iframe do Owlbear; fora dele a página mostra um
aviso explicando o que fazer.

### Nunca use `vh`/`vw` dentro da janela do handout

Essas unidades medem o **iframe**, e é o iframe que redimensionamos a partir do
card. O card encolhia, o teto encolhia junto, e a janela virava um talo. Os
tetos vêm de `OBR.viewport`, a tela real. Foi o bug **B14**.

Pelo mesmo motivo, **nada de `transform` no `.modal`**: o `ResizeObserver` mede
com `getBoundingClientRect()`, que inclui a transformação. Só `opacity` é segura
para animar ali.

---

## Publicação

**Cloudflare Pages**, em
[handouts-owlbear-extension.pages.dev](https://handouts-owlbear-extension.pages.dev/manifest.json).
Deploy a cada push na `main`; build `npm run build`, saída `dist`.

**Por que um host que sirva na raiz:** o projeto usa caminhos absolutos
(`/pages/handout.html`, `/pages/background.html`, `/logo.svg`, `/icon.svg`). O
GitHub Pages serve em subpasta e quebraria todos. Netlify e Vercel serviriam
igualmente bem.

O `public/_headers` define a política de cache. O ponto crítico é o
`manifest.json` em `no-cache`: é o endereço que o Owlbear guardou de quem já
instalou, e cacheado impediria que essas pessoas recebessem atualizações.

> O Cloudflare compila ao ver o push, **em paralelo** e sem consultar o GitHub
> Actions. O CI detecta um deploy quebrado; não o impede.
