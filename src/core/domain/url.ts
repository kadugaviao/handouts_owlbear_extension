/**
 * Validação de URL de imagem.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * A URL de uma imagem chega de três fronteiras que NÃO são confiáveis:
 *
 *   1. O campo de edição — o mestre digita o que quiser.
 *   2. A importação de backup — um arquivo JSON de origem desconhecida.
 *   3. O broadcast — qualquer pessoa conectada na sala pode emitir.
 *
 * A terceira é a mais perigosa: o SDK do Owlbear não restringe quem emite num
 * canal, então um participante mal-intencionado poderia mandar uma mensagem
 * forjada e abrir uma imagem arbitrária na tela de todo mundo.
 *
 * Um `javascript:` dentro de `<img src>` não executa nos navegadores atuais,
 * mas `data:` permite embutir conteúdo arbitrário, e basta essa URL migrar um
 * dia para um `<a href>` para virar XSS de verdade. Validar o esquema na
 * fronteira é defesa em profundidade: barato agora, evita a classe inteira.
 */

/** Só estes esquemas podem ser renderizados como imagem. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * A URL é segura para usar em `<img src>`?
 *
 * Recusa `javascript:`, `data:`, `blob:`, `file:` e qualquer coisa que não
 * seja uma URL absoluta bem formada.
 */
export function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    return ALLOWED_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    // URL relativa ou malformada: não sabemos de onde veio, então não usamos.
    return false;
  }
}

/** Devolve a URL se for segura, senão string vazia (a UI trata como "sem imagem"). */
export function sanitizeImageUrl(value: unknown): string {
  return isSafeImageUrl(value) ? value : "";
}

/* -------------------------------------------------------------------------
   Redimensionamento pelo CDN do Owlbear

   O custo de MEMÓRIA de uma imagem é `largura × altura × 4 bytes`
   DECODIFICADA — independe do tamanho do arquivo e do tamanho em que ela
   aparece na tela. Uma ilustração de 2048×2048 ocupa 16 MB mesmo renderizada
   numa miniatura de 32 px.

   O CDN do Owlbear aceita `?width=N` e devolve a imagem realmente
   redimensionada (verificado: 256×256 → 64×64 com `?width=64`). Pedir o
   tamanho que vamos exibir derruba o custo em ordens de grandeza.

   Atenção: `?w=N` NÃO funciona (é ignorado) e `&w=N` devolve HTTP 400.
------------------------------------------------------------------------- */

/** Host do CDN de imagens do Owlbear. Só nele podemos pedir redimensionamento. */
const OWLBEAR_IMAGE_HOST = "images.owlbear.rodeo";

/**
 * Pede ao CDN do Owlbear uma versão da imagem com a largura dada.
 *
 * URLs de outros domínios voltam intactas: o mestre pode colar um endereço de
 * qualquer lugar, e acrescentar `?width=` numa URL alheia iria de "sem efeito"
 * a "quebra a imagem".
 *
 * @param width largura desejada em pixels de dispositivo
 */
export function resizedImageUrl(url: string, width: number): string {
  if (!isSafeImageUrl(url)) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== OWLBEAR_IMAGE_HOST) return url;
    parsed.searchParams.set("width", String(Math.round(width)));
    return parsed.toString();
  } catch {
    return url;
  }
}
