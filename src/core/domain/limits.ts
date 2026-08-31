/**
 * Orçamento de tamanho da metadata da sala.
 *
 * A documentação do Owlbear é explícita: "In total the room metadata must be
 * under 16kB." Esse teto vale para a metadata INTEIRA da sala — dividida com
 * todas as outras extensões instaladas. Se estourar, a escrita falha; sem um
 * guarda, ela falharia em silêncio e o mestre perderia trabalho sem entender.
 *
 * https://docs.owlbear.rodeo/extensions/apis/room#setmetadata
 */

/** Teto absoluto documentado pelo Owlbear, em bytes. */
export const ROOM_METADATA_LIMIT = 16 * 1024;

/**
 * Fração do teto que reservamos. O resto fica para as outras extensões da
 * mesma sala — ser guloso aqui quebraria a extensão do vizinho.
 */
const OUR_SHARE = 0.625; // 10 de 16 kB

/** O orçamento do journal, derivado do teto para a relação ficar explícita. */
export const OUR_METADATA_BUDGET = Math.floor(ROOM_METADATA_LIMIT * OUR_SHARE);

/** A partir daqui a interface começa a avisar. */
const WARN_THRESHOLD = 0.75;

/** Tamanho real em bytes do valor serializado (UTF-8, não caracteres). */
function byteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export interface BudgetStatus {
  used: number;
  budget: number;
  ratio: number;
  /** Passou do limite: a escrita deve ser recusada. */
  exceeded: boolean;
  /** Está chegando perto: vale avisar, mas ainda grava. */
  warning: boolean;
}

export function checkBudget(value: unknown): BudgetStatus {
  const used = byteSize(value);
  const ratio = used / OUR_METADATA_BUDGET;
  return {
    used,
    budget: OUR_METADATA_BUDGET,
    ratio,
    exceeded: used > OUR_METADATA_BUDGET,
    warning: ratio >= WARN_THRESHOLD,
  };
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

/**
 * Erro de orçamento estourado, com uma mensagem que diz ao mestre o que fazer.
 */
export class MetadataBudgetError extends Error {
  constructor(public status: BudgetStatus) {
    super(
      `O journal ocupa ${formatBytes(status.used)}, acima do limite de ` +
        `${formatBytes(status.budget)} que o Owlbear reserva para a sala. ` +
        `Encurte as descrições e notas, ou exclua handouts que não usa mais. ` +
        `Use "Exportar" antes para não perder nada.`,
    );
    this.name = "MetadataBudgetError";
  }
}
