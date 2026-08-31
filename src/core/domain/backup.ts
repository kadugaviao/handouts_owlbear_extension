/**
 * Exportar / importar o journal em JSON.
 *
 * Rede de segurança contra perder a sala, e um jeito de levar o material para
 * outra campanha. Não toca no SDK do Owlbear — é só serialização.
 */
import { parseHandout, type Handout } from "./handout";

/**
 * Versão do formato de exportação JSON.
 *
 * Mora aqui, e não em `owlbear/constants.ts`, porque é conceito do formato de
 * backup — nada a ver com o SDK. `domain/` não pode importar de `owlbear/`.
 */
export const EXPORT_FORMAT_VERSION = 1;

interface BackupFile {
  format: "obr-handouts";
  version: number;
  exportedAt: string;
  handouts: Handout[];
}

export function serializeBackup(handouts: Handout[]): string {
  const file: BackupFile = {
    format: "obr-handouts",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    handouts,
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Lê um backup. Aceita tanto o envelope completo quanto um array cru de
 * handouts, para não travar em arquivo editado à mão.
 *
 * @throws Error com mensagem legível se o conteúdo não for aproveitável.
 */
export function parseBackup(text: string): Handout[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Arquivo não é um JSON válido.");
  }

  // A versão era gravada e nunca conferida — campo decorativo. Um arquivo de
  // formato mais novo entraria em silêncio e poderia perder campos que esta
  // versão não conhece.
  if (typeof data === "object" && data !== null) {
    const version = (data as { version?: unknown }).version;
    if (typeof version === "number" && version > EXPORT_FORMAT_VERSION) {
      throw new Error(
        `Este backup é da versão ${version}, e esta extensão lê até a ` +
          `${EXPORT_FORMAT_VERSION}. Atualize a extensão antes de importar.`,
      );
    }
  }

  const rawList = Array.isArray(data)
    ? data
    : typeof data === "object" && data !== null
      ? (data as { handouts?: unknown }).handouts
      : undefined;

  if (!Array.isArray(rawList)) {
    throw new Error("JSON não contém uma lista de handouts.");
  }

  const handouts = rawList
    .map(parseHandout)
    .filter((h): h is Handout => h !== null);

  if (handouts.length === 0) {
    throw new Error("Nenhum handout aproveitável no arquivo.");
  }

  return handouts;
}

/**
 * Dispara o download do backup.
 *
 * Extensões do Owlbear rodam num iframe, e um iframe com sandbox restritivo
 * pode bloquear downloads silenciosamente. Por isso devolvemos um booleano: a
 * interface cai para "copiar o JSON" quando o download não acontece.
 */
export function downloadBackup(handouts: Handout[]): boolean {
  try {
    const blob = new Blob([serializeBackup(handouts)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `handouts-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revogar imediatamente cancelaria o download em alguns navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

