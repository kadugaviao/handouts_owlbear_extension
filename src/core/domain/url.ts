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
