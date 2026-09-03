/**
 * Página de background — declarada em `manifest.json` como `background_url`.
 *
 * O Owlbear carrega esta página num iframe oculto assim que a extensão é
 * instalada e a mantém viva enquanto a sala estiver aberta. É por isso que o
 * listener de "mostrar" mora aqui: o jogador recebe o handout mesmo com todos
 * os popovers fechados — que é o caso normal.
 */
import OBR from "@owlbear-rodeo/sdk";
import { startShareListener } from "../core/owlbear/client";

// A página de background só é carregada pelo próprio Owlbear, então aqui o
// `onReady` direto basta — não há o caso "aberta solta no navegador".
OBR.onReady(() => {
  // >>> OBR: recepção do "mostrar" → abre o popover neste cliente.
  //
  // O "retirar" NÃO é tratado aqui: quem sabe qual handout está na tela é a
  // própria janela, e é ela que escuta (`onHandoutRevoked`).
  startShareListener();
});
