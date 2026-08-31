/**
 * Identificadores da extensão.
 *
 * O Owlbear exige que toda chave de metadata e todo canal de broadcast sejam
 * prefixados com um ID reverso-DNS único — sem isso você colide com outras
 * extensões instaladas na mesma sala.
 */
export const EXTENSION_ID = "com.gaviao.obr-handouts";

/** Chave sob a qual a lista de handouts vive em `OBR.room.getMetadata()`. */
export const HANDOUTS_METADATA_KEY = `${EXTENSION_ID}/handouts`;

/** Canal do "Show to Players": abre o pop-up na tela dos jogadores. */
export const SHARE_CHANNEL = `${EXTENSION_ID}/share`;

/** Canal do "Retirar": fecha o pop-up na tela dos jogadores. */
export const REVOKE_CHANNEL = `${EXTENSION_ID}/revoke`;

/** ID do popover flutuante do handout (usado para abrir E para fechar). */
export const HANDOUT_POPOVER_ID = `${EXTENSION_ID}/handout-popover`;

/**
 * Tamanho INICIAL do popover do handout.
 *
 * Logo após abrir, `resizeHandoutPopover` ajusta ao tamanho real do card —
 * estes números só valem no primeiro quadro, antes da imagem carregar.
 */
export const HANDOUT_POPOVER_SIZE = { width: 620, height: 700 };
