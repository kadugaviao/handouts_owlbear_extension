/**
 * Modelo de dados dos handouts.
 *
 * ONDE AS COISAS MORAM
 * --------------------
 * A BIBLIOTECA é o gerenciador de imagens do próprio Owlbear
 * (`OBR.assets.downloadImages`). Ele é ilimitado, já organiza e nomeia os
 * arquivos, e não consome nada do nosso orçamento. É lá que ficam TODAS as
 * imagens do mestre.
 *
 * A METADATA DA SALA guarda só o que a biblioteca não sabe guardar, e só para
 * os handouts que realmente precisam:
 *   - os que estão LIBERADOS para os jogadores agora, e
 *   - os que o mestre ANOTOU (descrição ou notas).
 *
 * Um retrato que o mestre mostra e nunca anota não ocupa nada de forma
 * permanente. Ver `isWorthStoring`.
 *
 * IDENTIDADE
 * ----------
 * A chave de um handout é a URL da imagem, não um id gerado por nós. Assim,
 * reabrir o mesmo arquivo da biblioteca reencontra as anotações que já
 * existiam — sem precisarmos manter um índice paralelo da biblioteca inteira.
 *
 * REGRA DE VISIBILIDADE
 * ---------------------
 *   - Mestre vê: title, imageUrl, description, notes
 *   - Jogador vê: title, imageUrl — e só se `sharedWithPlayers` for true
 *
 * AVISO DE PRIVACIDADE: a metadata da sala é legível por todos os clientes — o
 * SDK não oferece armazenamento privado. O ocultamento é de INTERFACE.
 */

import { isSafeImageUrl } from "./url";

/** O registro persistido. Só existe para handouts liberados ou anotados. */
export interface Handout {
  /** URL da imagem no CDN do Owlbear. É a identidade do handout. */
  imageUrl: string;
  title: string;
  /** Texto descritivo — SÓ O MESTRE VÊ. */
  description: string;
  /** Anotações secretas — SÓ O MESTRE VÊ. */
  notes: string;
  /** Liberado: aparece na lista dos jogadores. */
  sharedWithPlayers: boolean;
}

/**
 * Um handout aberto da biblioteca que ainda não tem registro. Existe só na
 * tela: a janela funciona normalmente, e ele só passa a ocupar espaço se o
 * mestre liberar ou escrever algo.
 */
export function untrackedHandout(imageUrl: string, title: string): Handout {
  return {
    imageUrl,
    title,
    description: "",
    notes: "",
    sharedWithPlayers: false,
  };
}

/**
 * Vale a pena gastar orçamento com este handout?
 *
 * Não liberado e sem nenhuma anotação = a biblioteca do Owlbear já guarda tudo
 * que ele é. Guardar de novo seria desperdício.
 */
export function isWorthStoring(handout: Handout): boolean {
  return (
    handout.sharedWithPlayers ||
    handout.description.trim() !== "" ||
    handout.notes.trim() !== ""
  );
}

/** Reduz um handout ao que o jogador tem direito de ver. */
export function toPlayerHandout(handout: Handout): Handout {
  return {
    imageUrl: handout.imageUrl,
    title: handout.title,
    description: "", // nunca chega ao jogador
    notes: "", // nunca chega ao jogador
    sharedWithPlayers: true,
  };
}

/**
 * Normaliza um objeto vindo da metadata ou de um JSON importado.
 * Aceita o formato antigo, que usava um `id` gerado por nós.
 */
export function parseHandout(raw: unknown): Handout | null {
  if (typeof raw !== "object" || raw === null) return null;
  const h = raw as Record<string, unknown>;
  // Esquema validado aqui, na fronteira: este é o ponto por onde passa tudo
  // que vem da metadata da sala e de backups importados.
  if (!isSafeImageUrl(h.imageUrl)) return null;
  return {
    imageUrl: h.imageUrl,
    title: typeof h.title === "string" ? h.title : "Sem título",
    description: typeof h.description === "string" ? h.description : "",
    notes: typeof h.notes === "string" ? h.notes : "",
    sharedWithPlayers: h.sharedWithPlayers === true,
  };
}

/* -------------------------------------------------------------------------
   Payloads de broadcast

   Carregam a imagem e o título junto: assim a janela do jogador desenha na
   hora, sem depender da metadata ter chegado antes do broadcast.
------------------------------------------------------------------------- */

export interface SharePayload {
  imageUrl: string;
  title: string;
}

export interface RevokePayload {
  imageUrl: string;
}

export function isSharePayload(data: unknown): data is SharePayload {
  if (typeof data !== "object" || data === null) return false;
  const p = data as Record<string, unknown>;
  // Qualquer participante da sala pode emitir num canal: o esquema da URL é
  // validado aqui para uma mensagem forjada não conseguir abrir conteúdo
  // arbitrário na tela dos outros.
  return isSafeImageUrl(p.imageUrl) && typeof p.title === "string";
}

export function isRevokePayload(data: unknown): data is RevokePayload {
  if (typeof data !== "object" || data === null) return false;
  return isSafeImageUrl((data as Record<string, unknown>).imageUrl);
}
