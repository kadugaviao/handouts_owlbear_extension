/**
 * Página de background — declarada em `manifest.json` como `background_url`.
 *
 * O Owlbear carrega esta página num iframe oculto assim que a extensão é
 * instalada e a mantém viva enquanto a sala estiver aberta. É por isso que os
 * listeners de "mostrar" e "retirar" moram aqui: o jogador recebe o handout
 * mesmo com todos os popovers fechados — que é o caso normal.
 */
import OBR from "@owlbear-rodeo/sdk";
import { startHandoutListeners } from "../core/owlbear/client";

// A página de background só é carregada pelo próprio Owlbear, então aqui o
// `onReady` direto basta — não há o caso "aberta solta no navegador".
OBR.onReady(() => {
  // >>> OBR: recepção dos broadcasts → abre/fecha o popover neste cliente.
  startHandoutListeners();
});
