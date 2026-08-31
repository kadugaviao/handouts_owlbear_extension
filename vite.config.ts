import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Origens do Owlbear Rodeo autorizadas a buscar arquivos do servidor de
 * desenvolvimento.
 *
 * POR QUE ISTO É NECESSÁRIO: o Vite 6 passou a restringir CORS à mesma origem
 * por padrão (correção da CVE-2025-24010). Sem esta configuração o
 * `owlbear.app` recebe a resposta SEM o cabeçalho `Access-Control-Allow-Origin`
 * e o navegador bloqueia — o que aparece na interface do Owlbear como
 * "NetworkError when attempting to fetch resource" ao adicionar a extensão.
 *
 * Os tutoriais oficiais do Owlbear foram escritos na era do Vite 4/5, quando
 * `cors: true` era o padrão, e por isso não mencionam nada disso.
 *
 * Liberamos só o Owlbear, e não `true` (que seria qualquer site): um servidor
 * de desenvolvimento com CORS aberto deixa qualquer página que você visite ler
 * o código-fonte deste projeto.
 */
const OWLBEAR_ORIGINS = [/^https:\/\/([a-z0-9-]+\.)*owlbear\.(app|rodeo)$/];

/**
 * Domínios de túnel aceitos como `Host` pelo servidor de desenvolvimento.
 *
 * POR QUE ISTO É NECESSÁRIO: o Vite 6 recusa requisições com `Host`
 * desconhecido ("Blocked request. This host is not allowed."), defesa contra
 * DNS rebinding. Um túnel entrega o `Host` dele, não `localhost`.
 *
 * PARA QUE SERVE O TÚNEL: testar com celular ou outro computador. Não dá para
 * usar o IP da rede local (`http://192.168.x.x`): o Owlbear é HTTPS, e o
 * navegador bloqueia como conteúdo misto — só `localhost` e `127.0.0.1` são
 * origens confiáveis por padrão. O túnel resolve porque entrega HTTPS de
 * verdade.
 */
const TUNNEL_HOSTS = [
  ".ngrok-free.app",
  ".ngrok.io",
  ".trycloudflare.com",
  ".loca.lt",
];

export default defineConfig({
  plugins: [react()],
  server: {
    cors: { origin: OWLBEAR_ORIGINS },
    allowedHosts: TUNNEL_HOSTS,
  },
  preview: {
    cors: { origin: OWLBEAR_ORIGINS },
    allowedHosts: TUNNEL_HOSTS,
  },
  build: {
    rollupOptions: {
      // Três entradas. `index.html` fica na raiz porque o manifest aponta a
      // action para "/"; as duas páginas internas moram em `pages/`, e o Vite
      // preserva essa estrutura no `dist`.
      input: {
        main: "index.html",
        handout: "pages/handout.html",
        background: "pages/background.html",
      },
    },
  },
});
