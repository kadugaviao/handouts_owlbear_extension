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
import { resizedImageUrl } from "../core/domain/url";

/**
 * Largura pedida ao CDN na visualização normal.
 *
 * O card tem no máximo 600 px; 1200 cobre telas de densidade dupla. No zoom
 * pedimos a original, porque aí o ponto é justamente ver em resolução cheia.
 *
 * Uma ilustração de 4096×4096 custa 64 MB de bitmap decodificado; a 1200 px,
 * 5,5 MB. O arquivo continua o mesmo no servidor — o que muda é o que o
 * navegador precisa manter em memória.
 */
const VIEW_WIDTH = 1200;

/** Os campos editáveis de um handout. */
interface Draft {
  title: string;
  imageUrl: string;
  description: string;
  notes: string;
}

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
  const [zoomed, setZoomed] = useState(false);
  const [busy, setBusy] = useState(false);

  /**
   * O rascunho da edição. `null` significa "não está editando".
   *
   * Antes eram DOIS estados (`editing` e `draft`) mantidos em sincronia por um
   * `useEffect` que reescrevia o rascunho a cada mudança de prop. Além de
   * cascatear renders, aquilo permitia o estado inválido "editando com rascunho
   * velho". Um único estado anulável elimina os dois: ao entrar na edição
   * tiramos uma fotografia das props; ao sair, jogamos fora.
   */
  const [draft, setDraft] = useState<Draft | null>(null);
  const editing = draft !== null;

  /**
   * Carregamento da imagem, atrelado à URL que o originou.
   *
   * Guardar a URL junto do estado é o que permite detectar troca de imagem
   * durante a renderização, sem `useEffect`.
   */
  const [imageState, setImageState] = useState({
    url: "",
    failed: false,
    // Enquanto a imagem não resolve, o card tem só a altura do cabeçalho.
    // Avisar o tamanho nesse instante encolheria o popover a um talo, e ele
    // voltaria a crescer quando a imagem chegasse — um salto feio.
    settled: false,
  });

  // Esc fecha a janela. Em modo de edição, Esc primeiro cancela a edição —
  // fechar direto descartaria o texto digitado sem aviso.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (editing) {
        setDraft(null);
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
    if (!element || !onResize || !imageState.settled) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        onResize({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onResize, imageState.settled]);

  /** Altera um campo do rascunho. Sem rascunho não há o que alterar. */
  function updateDraft(patch: Partial<Draft>) {
    setDraft((d) => (d === null ? d : { ...d, ...patch }));
  }

  async function handleSave(atual: Draft) {
    setBusy(true);
    try {
      const saved = await onSave?.({
        ...atual,
        title: atual.title.trim() || "Sem título",
        imageUrl: atual.imageUrl.trim(),
      });
      // Descartar o rascunho é o que sai da edição. Se a gravação falhou
      // (orçamento estourado, por exemplo), ficamos onde estamos: o texto
      // digitado continua na tela, junto da mensagem de erro.
      if (saved !== false) setDraft(null);
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
        setDraft((d) =>
          d === null
            ? d
            : {
                ...d,
                imageUrl: picked.url,
                // O nome do arquivo vira o título quando ainda não há um.
                title: d.title.trim() || picked.name,
              },
        );
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

  const rawUrl = draft?.imageUrl ?? imageUrl;
  // No zoom, a original. Fora dele, só os pixels que cabem na tela.
  const shownUrl = zoomed ? rawUrl : resizedImageUrl(rawUrl, VIEW_WIDTH);

  // Ajuste de estado DURANTE a renderização — o padrão que o React documenta
  // para "resetar estado quando uma prop muda". Chamar setState aqui descarta o
  // render em curso e reexecuta o componente antes de pintar, sem o
  // cascateamento que um `useEffect` provocaria.
  // https://react.dev/learn/you-might-not-need-an-effect
  if (imageState.url !== shownUrl) {
    // Sem imagem não há o que esperar: o card já está no tamanho final.
    setImageState({ url: shownUrl, failed: false, settled: !shownUrl });
  }

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
                updateDraft({ title: e.target.value })
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
              onClick={() =>
              draft
                ? void handleSave(draft)
                : setDraft({ title, imageUrl, description, notes })
            }
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
                  updateDraft({ imageUrl: e.target.value })
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
        {shownUrl && !imageState.failed ? (
          <img
            className={`${styles.image} ${zoomed ? styles.zoomed : ""}`}
            src={shownUrl}
            alt={title}
            decoding="async"
            onLoad={() => setImageState((i) => ({ ...i, settled: true }))}
            onError={() =>
              // Falhou: o card já está no tamanho final, então também assenta.
              setImageState((i) => ({ ...i, failed: true, settled: true }))
            }
          />
        ) : (
          <p className={styles.empty}>
            {imageState.failed
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
                  updateDraft({ description: e.target.value })
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
                  updateDraft({ notes: e.target.value })
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
