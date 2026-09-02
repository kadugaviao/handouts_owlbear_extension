/**
 * Camada de comunicação com o Owlbear Rodeo.
 *
 * Todo acesso ao `@owlbear-rodeo/sdk` fica AQUI. Os componentes de UI não
 * importam o SDK — o que os deixa testáveis e o modal reutilizável.
 */
import OBR from "@owlbear-rodeo/sdk";
import {
  HANDOUT_POPOVER_ID,
  HANDOUT_POPOVER_SIZE,
  REVOKE_CHANNEL,
  SHARE_CHANNEL,
} from "./constants";
import {
  isRevokePayload,
  isSharePayload,
  type RevokePayload,
  type SharePayload,
} from "../domain/handout";

/**
 * Monta a URL do popover.
 *
 * A imagem e o título viajam NA PRÓPRIA URL. Isso é deliberado: a janela
 * desenha imediatamente, sem depender de a metadata da sala ter chegado antes
 * do broadcast — e funciona para handouts que nem têm registro na metadata,
 * que é o caso normal agora que a biblioteca do Owlbear é a fonte.
 */
function handoutPopoverUrl(imageUrl: string, title: string): string {
  const params = new URLSearchParams({ src: imageUrl, title });
  return `/pages/handout.html?${params.toString()}`;
}

/**
 * Abre o handout no cliente LOCAL. Não emite nada para a sala.
 *
 * Detalhes de posicionamento que importam:
 *  - `hidePaper: true` remove o card escuro que o Owlbear desenha por padrão.
 *    Sem isso, nosso card branco renderiza DENTRO de outro card — dois frames
 *    aninhados.
 *  - `disableClickAway: true` impede que um clique no mapa feche o handout que
 *    o mestre acabou de mostrar. Só o "X" fecha.
 *  - Sem âncora explícita o popover cola no canto da tela; ancoramos no centro
 *    do viewport.
 */
export async function openHandoutLocally(
  imageUrl: string,
  title: string,
): Promise<void> {
  const [viewportWidth, viewportHeight] = await Promise.all([
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
  ]);

  // >>> OBR: abre um popover flutuante sobre o mapa, no cliente local.
  await OBR.popover.open({
    id: HANDOUT_POPOVER_ID,
    url: handoutPopoverUrl(imageUrl, title),
    width: HANDOUT_POPOVER_SIZE.width,
    height: HANDOUT_POPOVER_SIZE.height,
    anchorReference: "POSITION",
    anchorPosition: {
      left: Math.round(viewportWidth / 2),
      top: Math.round(viewportHeight / 2),
    },
    anchorOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    transformOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    hidePaper: true,
    disableClickAway: true,
  });
}

/**
 * Tamanho da janela REAL do Owlbear, em pixels.
 *
 * É a única referência confiável para limitar o card: dentro do popover,
 * `vh`/`vw` medem o próprio iframe, que nós redimensionamos — usá-las cria
 * realimentação.
 */
export async function getScreenSize(): Promise<{
  width: number;
  height: number;
}> {
  const [width, height] = await Promise.all([
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
  ]);
  return { width, height };
}

/**
 * Ajusta o popover ao tamanho real do conteúdo.
 *
 * Sem isto o popover fica fixo em 620×700 mesmo quando o handout é um token
 * pequeno. O excesso é um iframe TRANSPARENTE — invisível, mas ele intercepta
 * os cliques que deveriam chegar ao mapa.
 */
export async function resizeHandoutPopover(
  width: number,
  height: number,
): Promise<void> {
  // >>> OBR: redimensiona o popover já aberto.
  await Promise.all([
    OBR.popover.setWidth(HANDOUT_POPOVER_ID, Math.ceil(width)),
    OBR.popover.setHeight(HANDOUT_POPOVER_ID, Math.ceil(height)),
  ]);
}

/** Fecha o popover do handout no cliente local (botão "X"). */
export async function closeHandoutPopover(): Promise<void> {
  // >>> OBR: fecha só aqui. Nenhum evento sai para a sala.
  await OBR.popover.close(HANDOUT_POPOVER_ID);
}

/**
 * "Show to Players": abre o handout na tela de todos os OUTROS clientes.
 *
 * `destination: "REMOTE"` faz a mensagem ir só para os outros — o mestre não
 * recebe o próprio broadcast, senão o popover dele reabriria sozinho.
 *
 * A permanência na lista do jogador NÃO vem daqui: vem da flag
 * `sharedWithPlayers` na metadata da sala. Este broadcast é só o "pula na tela
 * agora". Quem chama os dois em conjunto é a camada de cima.
 */
export async function broadcastShowHandout(
  imageUrl: string,
  title: string,
): Promise<void> {
  const payload: SharePayload = { imageUrl, title };
  // >>> OBR: emissão de rede. É este o evento que os jogadores escutam.
  await OBR.broadcast.sendMessage(SHARE_CHANNEL, payload, {
    destination: "REMOTE",
  });
}

/**
 * "Retirar": fecha o handout na tela de quem estiver com ele aberto.
 *
 * Cada cliente confere se o popover aberto é DESTE handout antes de fechar —
 * senão o mestre retirando o handout A fecharia o handout B que o jogador
 * estava lendo.
 */
export async function broadcastHideHandout(imageUrl: string): Promise<void> {
  const payload: RevokePayload = { imageUrl };
  // >>> OBR: emissão de rede do "tira isso da tela".
  await OBR.broadcast.sendMessage(REVOKE_CHANNEL, payload, {
    destination: "REMOTE",
  });
}

/**
 * Registra os listeners que reagem ao mestre. Roda na página de
 * `background_url`, não no popover: se vivesse no popover, um jogador com o
 * popover fechado nunca receberia nada — e esse é o caso normal.
 *
 * @returns função de unsubscribe.
 */
/**
 * O emissor desta mensagem é o mestre?
 *
 * O SDK do Owlbear NÃO restringe quem pode emitir num canal de broadcast. Sem
 * esta checagem, qualquer participante da sala poderia forjar um "mostrar" e
 * abrir uma imagem na tela de todo mundo, ou forjar um "retirar" e fechar o
 * handout que o mestre acabou de apresentar.
 *
 * Como usamos `destination: "REMOTE"`, o emissor é sempre outro cliente — e
 * portanto aparece em `OBR.party.getPlayers()`.
 */
async function isFromGM(connectionId: string): Promise<boolean> {
  try {
    // >>> OBR: lista os outros participantes para descobrir o papel do emissor.
    const players = await OBR.party.getPlayers();
    return players.some(
      (p) => p.connectionId === connectionId && p.role === "GM",
    );
  } catch {
    // Na dúvida, não obedece.
    return false;
  }
}

export function startHandoutListeners(): () => void {
  // Qual handout este cliente tem aberto agora. Precisamos saber para que o
  // "retirar" do handout A não feche o handout B que o jogador está lendo.
  let openImageUrl: string | null = null;

  // >>> OBR: recepção do "mostrar".
  const unsubscribeShare = OBR.broadcast.onMessage(SHARE_CHANNEL, (event) => {
    // `isSharePayload` já valida o esquema da URL (nada de javascript:/data:).
    if (!isSharePayload(event.data)) return;
    const payload = event.data;
    void isFromGM(event.connectionId).then((fromGM) => {
      if (!fromGM) return; // só o mestre manda abrir
      openImageUrl = payload.imageUrl;
      void openHandoutLocally(payload.imageUrl, payload.title);
    });
  });

  // >>> OBR: recepção do "retirar".
  const unsubscribeRevoke = OBR.broadcast.onMessage(REVOKE_CHANNEL, (event) => {
    if (!isRevokePayload(event.data)) return;
    const payload = event.data;
    void isFromGM(event.connectionId).then((fromGM) => {
      if (!fromGM) return; // só o mestre manda fechar
      if (openImageUrl !== payload.imageUrl) return; // é outro handout
      openImageUrl = null;
      void closeHandoutPopover();
    });
  });

  return () => {
    unsubscribeShare();
    unsubscribeRevoke();
  };
}

/**
 * Abre o gerenciador de imagens NATIVO do Owlbear para o mestre subir ou
 * escolher um arquivo do computador. O upload e a hospedagem são
 * responsabilidade do Owlbear; de volta vem uma URL do CDN deles, visível por
 * todos os jogadores da sala.
 *
 * @returns `{ url, name }` da imagem escolhida, ou `null` se o mestre cancelou.
 */
export async function pickImageFromOwlbear(): Promise<{
  url: string;
  name: string;
} | null> {
  // >>> OBR: abre a UI de upload/seleção de imagens do próprio Owlbear.
  const images = await OBR.assets.downloadImages(false, undefined, "NOTE");
  const image = images[0];
  if (!image) return null;
  // `image.image` também traz `width` e `height` reais. Deliberadamente NÃO os
  // guardamos: seriam ~20 B por handout, 10% do orçamento de 10 kB, para
  // evitar apenas um salto de layout. Ver `documents/spec.md`, Etapa 14.
  return { url: image.image.url, name: image.name };
}
