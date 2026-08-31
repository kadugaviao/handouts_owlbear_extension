/**
 * HandoutModal — a interface. Puro React: NÃO importa o SDK do Owlbear.
 *
 * Tudo que toca a rede (broadcast, popover, upload) chega por callback vindo do
 * `obrSync.ts`. Isso mantém o modal testável e reutilizável.
 *
 * VISIBILIDADE: `canEdit` distingue mestre de jogador. Quando é `false`, a
 * seção de descrição/notas nem é renderizada — e, na prática, esses campos
 * chegam vazios porque `useHandouts` já os descartou na fronteira de dados.
 */
import { useEffect, useRef, useState } from "react";
import {
  Check,
  EyeOff,
  FileText,
  Lock,
  Pencil,
  Search,
  Upload,
  Users,
  X,
} from "lucide-react";
import styles from "./HandoutModal.module.css";

export interface HandoutModalProps {
  title: string;
  imageUrl: string;
  /** Só o mestre vê. String vazia num cliente de jogador. */
  description: string;
  /** Só o mestre vê. String vazia num cliente de jogador. */
  notes: string;
  /** Handout já liberado para os jogadores. */
  sharedWithPlayers: boolean;
  /** Mestre = true. Controla edição, textos e o botão de liberar. */
  canEdit: boolean;
  /** Falha de escrita (ex.: orçamento de metadata da sala estourado). */
  writeError?: string | null;
  /**
   * Chamado quando o tamanho renderizado do card muda, para que a página possa
   * ajustar o popover e não deixar iframe transparente sobrando por cima do
   * mapa. Recebe as dimensões em pixels de CSS.
   */
  onResize?: (size: { width: number; height: number }) => void;
  /**
   * Tetos em pixels, calculados a partir da tela real. Vêm por prop porque
   * `vh`/`vw` no CSS mediriam o iframe do popover, que é redimensionado a
   * partir deste card — realimentação.
   */
  maxSize?: { width: number; height: number };
  /** Alterna liberado/retirado. Ausente = botão escondido (cliente jogador). */
  onToggleShare?: () => void | Promise<void>;
  /** "X" — fecha só no cliente local, sem emitir evento. */
  onClose: () => void | Promise<void>;
  /** Salvar as edições. */
  /**
   * Salva as edições. Deve devolver `false` quando a gravação falha — o modal
   * mantém o modo de edição e o texto digitado em vez de descartá-los.
   */
  onSave?: (patch: {
    title: string;
    imageUrl: string;
    description: string;
    notes: string;
  }) => boolean | Promise<boolean>;
  /** Abre o gerenciador de imagens do Owlbear; devolve a URL hospedada. */
  onPickImage?: () => Promise<{ url: string; name: string } | null>;
}

export function HandoutModal({
  title,
  imageUrl,
  description,
  notes,
  sharedWithPlayers,
  canEdit,
  writeError,
  onResize,
  maxSize,
  onToggleShare,
  onClose,
  onSave,
  onPickImage,
}: HandoutModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  // Enquanto a imagem não resolve, o card tem só a altura do cabeçalho. Avisar
  // o tamanho nesse instante encolheria o popover a um talo, e ele voltaria a
  // crescer quando a imagem chegasse — um salto feio. Só reportamos depois.
  const [imageSettled, setImageSettled] = useState(false);
  const [draft, setDraft] = useState({ title, imageUrl, description, notes });

  // Esc fecha a janela. Em modo de edição, Esc primeiro cancela a edição —
  // fechar direto descartaria o texto digitado sem aviso.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (editing) {
        setEditing(false);
      } else {
        void onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, onClose]);

  // Observa o tamanho real do card. `ResizeObserver` cobre tudo que muda a
  // altura: a imagem carregando, entrar em modo de edição, abrir o zoom.
  useEffect(() => {
    const element = modalRef.current;
    if (!element || !onResize || !imageSettled) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        onResize({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onResize, imageSettled]);

  // Se o handout mudar por fora (outro cliente editou), sincroniza o rascunho —
  // mas nunca por cima do que o mestre está digitando.
  useEffect(() => {
    if (!editing) setDraft({ title, imageUrl, description, notes });
  }, [title, imageUrl, description, notes, editing]);

  async function handleSave() {
    setBusy(true);
    try {
      const saved = await onSave?.({
        ...draft,
        title: draft.title.trim() || "Sem título",
        imageUrl: draft.imageUrl.trim(),
      });
      // Sair da edição descarta o rascunho. Se a gravação falhou (orçamento
      // estourado, por exemplo), ficamos onde estamos: o texto digitado
      // continua na tela, junto da mensagem de erro.
      if (saved !== false) setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function handlePickImage() {
    if (!onPickImage) return;
    setBusy(true);
    try {
      const picked = await onPickImage();
      if (picked) {
        setDraft((d) => ({
          ...d,
          imageUrl: picked.url,
          // O nome do arquivo vira o título quando ainda não há um.
          title: d.title.trim() || picked.name,
        }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleShare() {
    setBusy(true);
    try {
      await onToggleShare?.();
    } finally {
      setBusy(false);
    }
  }

  const shownUrl = editing ? draft.imageUrl : imageUrl;

  // Nova URL merece nova chance de carregar.
  useEffect(() => {
    setImageFailed(false);
    // Sem imagem não há o que esperar: o card já está no tamanho final.
    setImageSettled(!shownUrl);
  }, [shownUrl]);

  return (
    <div
      ref={modalRef}
      className={`${styles.modal} ${zoomed ? styles.zoomed : ""}`}
      style={
        maxSize
          ? {
              maxWidth: maxSize.width,
              maxHeight: maxSize.height,
              // No zoom o card vai ao teto — valor absoluto vindo da tela
              // real, nunca uma porcentagem do iframe.
              ...(zoomed ? { width: maxSize.width } : null),
            }
          : undefined
      }
    >
      {/* ---------- 2. Cabeçalho ---------- */}
      <header className={styles.header}>
        <div className={styles.identity}>
          <FileText size={18} className={styles.icon} aria-hidden />
          {editing ? (
            <input
              className={styles.titleInput}
              value={draft.title}
              onChange={(e) =>
                setDraft((d) => ({ ...d, title: e.target.value }))
              }
              placeholder="Título do handout"
              aria-label="Título do handout"
              autoFocus
            />
          ) : (
            <span className={styles.title} title={title}>
              {title}
            </span>
          )}
        </div>

        <div className={styles.actions}>
          {/* Botão único que alterna: Show to Players <-> Retirar.
              >>> OBR: dispara broadcast + grava a flag (ver handout.tsx). */}
          {canEdit && onToggleShare && !editing && (
            <button
              type="button"
              className={`${styles.button} ${sharedWithPlayers ? styles.shared : ""}`}
              onClick={() => void handleToggleShare()}
              disabled={busy || !imageUrl}
              title={
                sharedWithPlayers
                  ? "Tira da lista dos jogadores e fecha na tela deles"
                  : "Libera na lista dos jogadores e abre na tela deles"
              }
            >
              {sharedWithPlayers ? (
                <EyeOff size={14} aria-hidden />
              ) : (
                <Users size={14} aria-hidden />
              )}
              {sharedWithPlayers ? "Retirar" : "Show to Players"}
            </button>
          )}

          {canEdit && onSave && (
            <button
              type="button"
              className={styles.button}
              onClick={() => (editing ? void handleSave() : setEditing(true))}
              disabled={busy}
            >
              {editing ? (
                <Check size={14} aria-hidden />
              ) : (
                <Pencil size={14} aria-hidden />
              )}
              {editing ? "Save" : "Edit"}
            </button>
          )}

          <button
            type="button"
            className={`${styles.button} ${styles.iconButton} ${zoomed ? styles.active : ""}`}
            onClick={() => setZoomed((z) => !z)}
            title={
              zoomed
                ? "Voltar ao tamanho nítido"
                : "Ampliar para preencher a largura"
            }
            aria-pressed={zoomed}
            aria-label="Zoom"
          >
            <Search size={14} aria-hidden />
          </button>

          {/* Fecha o popover só neste cliente. Nenhum evento vai para a sala. */}
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => void onClose()}
            title="Fechar"
            aria-label="Fechar"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      </header>

      {/* Uma edição pode ser recusada por estourar o orçamento de 16 kB da
          metadata da sala. Sem isto o Save pareceria ter funcionado. */}
      {writeError && <p className={styles.writeError}>{writeError}</p>}

      {/* ---------- Escolha da imagem (só em edição) ---------- */}
      {editing && (
        <div className={styles.editPanel}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="handout-url">
              Imagem
            </label>
            <div className={styles.urlRow}>
              <input
                id="handout-url"
                className={styles.input}
                value={draft.imageUrl}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, imageUrl: e.target.value }))
                }
                placeholder="https://... ou escolha um arquivo"
              />
              {onPickImage && (
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => void handlePickImage()}
                  disabled={busy}
                >
                  <Upload size={14} aria-hidden />
                  Escolher arquivo
                </button>
              )}
            </div>
            <p className={styles.hint}>
              "Escolher arquivo" abre o gerenciador de imagens do Owlbear: o
              upload fica hospedado por eles e a URL resultante funciona para
              todos os jogadores da sala.
            </p>
          </div>
        </div>
      )}

      {/* ---------- 3. Corpo: a imagem ---------- */}
      <div className={styles.body}>
        {shownUrl && !imageFailed ? (
          <img
            className={`${styles.image} ${zoomed ? styles.zoomed : ""}`}
            src={shownUrl}
            alt={title}
            decoding="async"
            onLoad={() => setImageSettled(true)}
            onError={() => {
              setImageFailed(true);
              setImageSettled(true); // o card já está no tamanho final
            }}
          />
        ) : (
          <p className={styles.empty}>
            {imageFailed
              ? "Não foi possível carregar esta imagem. O endereço pode ter expirado ou o arquivo foi removido da biblioteca."
              : canEdit
                ? 'Nenhuma imagem definida. Clique em "Edit" para escolher uma.'
                : "Este handout está sem imagem."}
          </p>
        )}
      </div>

      {/* ---------- Descrição e notas: EXCLUSIVAS DO MESTRE ----------
          O jogador nunca renderiza esta seção, e os campos chegam vazios ao
          cliente dele — `useHandouts` os descarta antes da UI. */}
      {canEdit && (
        <section className={styles.gmSection}>
          <span className={styles.gmBadge}>
            <Lock size={10} aria-hidden />
            Só o mestre vê
          </span>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="handout-description">
              Descrição
            </label>
            {editing ? (
              <textarea
                id="handout-description"
                className={styles.textarea}
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                placeholder="Do que se trata este handout?"
              />
            ) : description ? (
              <p className={styles.readonlyText}>{description}</p>
            ) : (
              <p className={styles.mutedText}>Sem descrição.</p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="handout-notes">
              Notas
            </label>
            {editing ? (
              <textarea
                id="handout-notes"
                className={styles.textarea}
                value={draft.notes}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, notes: e.target.value }))
                }
                placeholder="Suas anotações secretas sobre este handout."
              />
            ) : notes ? (
              <p className={styles.readonlyText}>{notes}</p>
            ) : (
              <p className={styles.mutedText}>Sem notas.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
