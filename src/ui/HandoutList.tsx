/**
 * HandoutList — o "journal": o que aparece no popover da action do Owlbear.
 * Clicar num item abre o HandoutModal flutuante sobre o mapa.
 *
 * O mestre vê a lista inteira, com um ponto verde nos handouts já liberados.
 * O jogador recebe daqui só os liberados — o filtro acontece em `useHandouts`,
 * não neste componente.
 */
import { useRef, useState } from "react";
import {
  ClipboardCopy,
  Download,
  Eye,
  FileText,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import styles from "./HandoutList.module.css";
import type { Handout } from "../core/domain/handout";
import { parseBackup } from "../core/domain/backup";
import { formatBytes, type BudgetStatus } from "../core/domain/limits";

export interface HandoutListProps {
  handouts: Handout[];
  isGM: boolean;
  onOpen: (handout: Handout) => void;
  /** Abre a biblioteca de imagens do Owlbear. */
  onOpenLibrary: () => void;
  onRemove: (handout: Handout) => void;
  /** Ocupação do orçamento de metadata da sala. Só mostrado ao mestre. */
  budget?: BudgetStatus;
  /** Falha de escrita vinda do hook (ex.: orçamento estourado). */
  writeError?: string | null;
  onDismissError?: () => void;
  /** Exporta o journal. Devolve false se o navegador bloqueou o download. */
  onExport?: () => boolean;
  /** JSON do journal, para o fallback de copiar quando o download falha. */
  exportText?: () => string;
  /**
   * Recebe a lista já validada e substitui o journal inteiro.
   * Devolve `false` quando a gravação falha.
   */
  onImport?: (handouts: Handout[]) => Promise<boolean>;
}

export function HandoutList({
  handouts,
  isGM,
  onOpen,
  onOpenLibrary,
  onRemove,
  budget,
  writeError,
  onDismissError,
  onExport,
  exportText,
  onImport,
}: HandoutListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Preenchido quando o download é bloqueado pelo sandbox do iframe.
  const [fallbackJson, setFallbackJson] = useState<string | null>(null);
  // Importação aguardando confirmação. Importar SUBSTITUI o journal inteiro e
  // não tem desfazer — inclusive tirando handouts da lista dos jogadores.
  const [pendingImport, setPendingImport] = useState<Handout[] | null>(null);
  // Exclusão aguardando confirmação. Um handout anotado perde as anotações para
  // sempre, e um liberado some da tela dos jogadores.
  const [pendingRemove, setPendingRemove] = useState<Handout | null>(null);

  function handleExport() {
    setError(null);
    setFallbackJson(null);
    if (onExport?.() === false) {
      // O iframe da extensão bloqueou o download — oferece copiar e colar.
      setFallbackJson(exportText?.() ?? "");
    }
  }

  /** Lê e valida o arquivo, mas NÃO grava: só prepara a confirmação. */
  async function handleFile(file: File | undefined) {
    if (!file || !onImport) return;
    setError(null);
    setPendingImport(null);
    try {
      const text = await file.text();
      setPendingImport(parseBackup(text)); // lança com mensagem legível
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao ler o arquivo.");
    }
  }

  async function confirmImport() {
    if (!pendingImport || !onImport) return;
    const handoutsToImport = pendingImport;
    setPendingImport(null);
    try {
      await onImport(handoutsToImport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao importar.");
    }
  }

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.heading}>
          <FileText size={18} aria-hidden />
          Handouts
        </span>
        {isGM && (
          <button
            type="button"
            className={styles.button}
            onClick={onOpenLibrary}
            title="Escolher uma imagem da sua biblioteca do Owlbear"
          >
            <Plus size={14} aria-hidden />
            Biblioteca
          </button>
        )}
      </header>

      {isGM && (onExport || onImport) && (
        <div className={styles.toolbar}>
          {onExport && (
            <button
              type="button"
              className={styles.smallButton}
              onClick={handleExport}
              title="Salvar uma cópia do journal em JSON"
            >
              <Download size={13} aria-hidden />
              Exportar
            </button>
          )}
          {onImport && (
            <>
              <button
                type="button"
                className={styles.smallButton}
                onClick={() => fileInputRef.current?.click()}
                title="Substituir o journal pelo conteúdo de um arquivo JSON"
              >
                <Upload size={13} aria-hidden />
                Importar
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className={styles.hiddenInput}
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = ""; // permite reimportar o mesmo arquivo
                }}
              />
            </>
          )}
        </div>
      )}

      {/* Orçamento: a metadata da sala INTEIRA precisa caber em 16 kB, e esse
          teto é dividido com as outras extensões. Só avisamos quando começa a
          apertar — poluir a interface com isso sempre não ajudaria ninguém. */}
      {isGM && budget && budget.warning && (
        <div className={styles.budget}>
          <div className={styles.budgetLabel}>
            <span>Espaço do journal na sala</span>
            <span>
              {formatBytes(budget.used)} / {formatBytes(budget.budget)}
            </span>
          </div>
          <div className={styles.budgetTrack}>
            <div
              className={`${styles.budgetFill} ${
                budget.exceeded
                  ? styles.exceeded
                  : budget.warning
                    ? styles.warning
                    : ""
              }`}
              style={{ width: `${Math.min(100, budget.ratio * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Confirmação de importação: substituir é irreversível, e o número de
          handouts que se perde precisa estar na cara antes do clique. */}
      {pendingImport && (
        <div className={styles.confirm}>
          <p className={styles.confirmText}>
            Importar <strong>{pendingImport.length}</strong>{" "}
            {pendingImport.length === 1 ? "handout" : "handouts"}?
            {handouts.length > 0 && (
              <>
                {" "}
                Isso <strong>substitui</strong> os {handouts.length} atuais
                {handouts.some((h) => h.sharedWithPlayers) && (
                  <>
                    , inclusive os que estão liberados para os jogadores
                  </>
                )}
                . Não há como desfazer.
              </>
            )}
          </p>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => setPendingImport(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.danger}`}
              onClick={() => void confirmImport()}
            >
              Substituir
            </button>
          </div>
        </div>
      )}

      {pendingRemove && (
        <div className={styles.confirm}>
          <p className={styles.confirmText}>
            Tirar <strong>{pendingRemove.title || "este handout"}</strong> do
            caderninho?
            {(pendingRemove.description.trim() ||
              pendingRemove.notes.trim()) && (
              <> As anotações serão perdidas.</>
            )}
            {pendingRemove.sharedWithPlayers && (
              <> Ele também some da tela dos jogadores.</>
            )}{" "}
            A imagem continua na sua biblioteca do Owlbear.
          </p>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => setPendingRemove(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.danger}`}
              onClick={() => {
                const target = pendingRemove;
                setPendingRemove(null);
                onRemove(target);
              }}
            >
              Tirar
            </button>
          </div>
        </div>
      )}

      {writeError && (
        <p className={styles.error}>
          {writeError}
          {onDismissError && (
            <button
              type="button"
              className={styles.dismiss}
              onClick={onDismissError}
            >
              dispensar
            </button>
          )}
        </p>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {fallbackJson !== null && (
        <div className={styles.fallback}>
          <p className={styles.hint}>
            O navegador bloqueou o download dentro da extensão. Copie o JSON:
          </p>
          <textarea
            className={styles.fallbackArea}
            readOnly
            value={fallbackJson}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className={styles.fallbackRow}>
            {/* Precisa da permissão "clipboard-write" declarada no manifest —
                sem ela o iframe da extensão bloqueia a área de transferência. */}
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => void navigator.clipboard?.writeText(fallbackJson)}
            >
              <ClipboardCopy size={13} aria-hidden />
              Copiar
            </button>
          </div>
        </div>
      )}

      {handouts.length === 0 ? (
        <p className={styles.empty}>
          {isGM ? (
            <>
              Nada no caderninho ainda.
              <br />
              Clique em <strong>Biblioteca</strong> para abrir uma imagem.
              <br />
              <br />
              Só aparece aqui o que estiver liberado para os jogadores ou o que
              você anotar — o resto vive na sua biblioteca do Owlbear.
            </>
          ) : (
            "O mestre ainda não liberou nenhum handout."
          )}
        </p>
      ) : (
        <ul className={styles.list}>
          {handouts.map((handout) => (
            <li key={handout.imageUrl} className={styles.item}>
              <button
                type="button"
                className={styles.itemButton}
                onClick={() => onOpen(handout)}
              >
                {handout.imageUrl ? (
                  <img
                    className={styles.thumb}
                    src={handout.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className={styles.thumb} />
                )}
                <span className={styles.itemTitle}>
                  {handout.title || "Sem título"}
                </span>
              </button>

              {/* Ponto verde: este handout está na lista dos jogadores. */}
              {isGM && handout.sharedWithPlayers && (
                <span
                  className={styles.sharedDot}
                  title="Liberado para os jogadores"
                >
                  <Eye size={14} aria-hidden />
                </span>
              )}

              {isGM && (
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => setPendingRemove(handout)}
                  title="Tirar do caderninho (a imagem continua na biblioteca)"
                  aria-label={`Tirar ${handout.title} do caderninho`}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
