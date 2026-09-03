# Handouts para Owlbear Rodeo

![CI](https://github.com/kadugaviao/handouts_owlbear_extension/actions/workflows/ci.yml/badge.svg)

Journal estilo Roll20: o mestre abre uma imagem da sua biblioteca numa janela
flutuante sobre o mapa, anota o que quiser, e libera para os jogadores com um
clique.

---

## Rodar

```bash
npm install
npm run dev
```

## Instalar no Owlbear

A extensão é instalada no **perfil**, não dentro de uma sala:

1. Abra [owlbear.app/profile](https://owlbear.app/profile)
2. **Add Extension** → cole `http://localhost:5173/manifest.json`
3. Crie uma sala **habilitando a extensão** no diálogo de criação

O passo 3 é fácil de esquecer: instalada mas não habilitada, ela não aparece.

> `localhost` só funciona na máquina onde o servidor está rodando. No celular
> ou em outro computador o Owlbear responde *"Não foi possível carregar a
> extensão"* — é o que `localhost` significa. Resolve com o deploy.

## Testar o fluxo com jogadores

O jogador **nunca instala nada** — a lista de extensões pertence à sala. Ele
abre o link de convite e o cliente dele carrega a extensão sozinho. O que ele
precisa é que a URL do manifest seja **alcançável do aparelho dele**.

### Na mesma máquina — para 95% dos testes

Basta abrir duas janelas do navegador. Ambas resolvem `localhost` para o mesmo
servidor, então funciona sem nenhuma configuração:

| Janela | Papel |
|---|---|
| Normal | mestre — cria a sala com a extensão habilitada |
| Anônima (ou outro perfil) | jogador — entra pelo link de convite |

É assim que se testa "Show to Players", a lista filtrada e o "Retirar".

### Em outro aparelho (celular, notebook do amigo)

Aqui `localhost` não serve: no celular, `localhost` é o próprio celular.

**Usar o IP da rede local não resolve.** O Owlbear é HTTPS e
`http://192.168.x.x` é bloqueado como [conteúdo misto](https://developer.mozilla.org/docs/Web/Security/Mixed_content)
— só `localhost` e `127.0.0.1` são origens confiáveis por padrão. Trocar a
porta não muda nada: o problema é o esquema, não a porta.

A saída é um **túnel HTTPS**:

```bash
npm run dev          # em um terminal
ngrok http 5173      # em outro
```

O ngrok devolve algo como `https://abc123.ngrok-free.app`. O link de instalação
vira `https://abc123.ngrok-free.app/manifest.json`, e aí qualquer aparelho
alcança.

> O `vite.config.ts` já aceita os domínios de ngrok, Cloudflare Tunnel e
> localtunnel em `allowedHosts` — sem isso o Vite 6 responde *"Blocked request.
> This host is not allowed."* O endereço do ngrok muda a cada execução no plano
> gratuito, então é preciso reinstalar a extensão a cada sessão.

Para testes recorrentes com o grupo, compensa publicar (ver **Publicar** abaixo)
em vez de manter um túnel.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção em `dist/` |
| `npm test` | Testes |
| `npm run lint` | ESLint |

O [CI](.github/workflows/ci.yml) roda os três últimos a cada push.

---

## Estrutura

```
index.html         entrada da action (o manifest aponta para "/")
pages/             páginas internas
├── handout.html     a janela flutuante
└── background.html  listeners sempre vivos
src/
├── core/          dados, regras e integração — sem React
│   ├── domain/      lógica pura, testável sem mocks
│   └── owlbear/     única camada que fala com o SDK
├── ui/            componentes React — sem SDK
└── pages/         os scripts das três páginas
```

A regra de dependência é `domain/ ← owlbear/ ← pages/ → ui/`, e ela é
**verificada por teste** (`architecture.test.ts`), não só documentada.

Cada camada tem seu próprio README com os detalhes:

| Onde | O quê |
|---|---|
| [`src/core/README.md`](src/core/README.md) | Regras de dados, segurança e desempenho |
| [`src/ui/README.md`](src/ui/README.md) | Componentes, CSS e as armadilhas conhecidas |
| [`PROJETO.md`](PROJETO.md) | Visão geral e estado do projeto |
| [`documents/spec.md`](documents/spec.md) | **Fonte da verdade**: histórico e decisões |

---

## Como funciona

**A biblioteca é o gerenciador de imagens do Owlbear** — ilimitado e fora do
nosso orçamento. A extensão guarda na metadata da sala apenas os handouts
liberados ou anotados; o resto é podado.

Isso importa porque a metadata da sala inteira precisa caber em **16 kB**,
dividida com todas as extensões instaladas.

| Situação do handout | Custo |
|---|---|
| Aberto da biblioteca, não liberado, sem nota | **0 B** |
| Liberado, sem anotação | 188 B |
| Anotado | 428 B – 1,4 kB |

**O jogador vê apenas título e imagem**, e só dos handouts liberados. Descrição
e notas nunca saem do mestre — o corte acontece na camada de dados, antes de
qualquer componente.

> **Privacidade:** o ocultamento é de interface, não criptografia. O Owlbear não
> oferece armazenamento privado, então um jogador com DevTools consegue ler a
> metadata da sala. É o mesmo modelo do Roll20. Detalhes em
> [`documents/spec.md`](documents/spec.md), decisão D4.

---

## Problemas comuns

### "NetworkError when attempting to fetch resource"

CORS. O **Vite 6 restringe CORS à mesma origem por padrão** (correção da
CVE-2025-24010), e os tutoriais do Owlbear são da era do Vite 4/5, quando
`cors: true` era o padrão.

O `vite.config.ts` já libera as origens do Owlbear — e **só** elas. Para
conferir:

```bash
curl -i -H "Origin: https://owlbear.app" http://localhost:5173/manifest.json | head -3
# precisa aparecer: Access-Control-Allow-Origin: https://owlbear.app
```

Nunca use `cors: true`: isso deixa qualquer página que você visite ler o
código-fonte do projeto pelo servidor de desenvolvimento.

### Página em branco ao abrir `localhost:5173` direto

Esperado. A extensão precisa do iframe do Owlbear para funcionar; fora dele a
página mostra um aviso explicando o que fazer.

---

## Publicar

O projeto usa caminhos absolutos a partir da raiz (`/pages/handout.html`,
`/pages/background.html`), então **precisa de um host que sirva na raiz**. O GitHub
Pages serve em subpasta e quebraria todos eles.

| Host | Endereço | Raiz? |
|---|---|---|
| **Cloudflare Pages** *(recomendado)* | `projeto.pages.dev` | ✅ |
| Netlify | `projeto.netlify.app` | ✅ |
| Vercel | `projeto.vercel.app` | ✅ |
| GitHub Pages | `usuario.github.io/repo/` | ❌ |

Build `npm run build`, pasta de saída `dist`. Passo a passo em
[`documents/spec.md`](documents/spec.md), seção P2.

O `public/_headers` já define a política de cache para Cloudflare Pages e
Netlify. O ponto crítico ali é o `manifest.json` em `no-cache`: é o endereço
que o Owlbear guarda para a extensão, e cacheado ele impediria que quem já
instalou recebesse atualizações.

---

## Stack

React 18 · TypeScript 5.7 · Vite 6 · Vitest 2 · ESLint 9 ·
`@owlbear-rodeo/sdk` 3.1 · CSS Modules (sem framework — roda em iframe, peso
importa).

## Licença

[MIT](LICENSE).
