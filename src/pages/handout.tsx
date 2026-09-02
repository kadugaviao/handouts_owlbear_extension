/**
 * Entrada do POPOVER FLUTUANTE do handout.
 *
 * URL: `/handout.html?src=<url da imagem>&title=<título>`
 *
 * A imagem e o título vêm na própria URL — a janela desenha na hora, sem
 * esperar a metadata da sala. A metadata é consultada só para descobrir se
 * este handout tem anotações e se já está liberado, e essa consulta é
 * exclusiva do mestre.
 *
 * Esta mesma página é aberta de dois jeitos:
 *  - pelo mestre, ao escolher uma imagem da biblioteca ou clicar na lista;
 *  - por cada jogador, quando o listener de background recebe o broadcast.
 */
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { HandoutModal } from "../ui/HandoutModal";
import { whenOwlbearReady } from "../core/owlbear/mount";
import { useHandouts } from "../core/owlbear/useHandouts";
import {
  broadcastHideHandout,
  broadcastShowHandout,
  closeHandoutPopover,
  getScreenSize,
  pickImageFromOwlbear,
  resizeHandoutPopover,
} from "../core/owlbear/client";
import { untrackedHandout } from "../core/domain/handout";
import { sanitizeImageUrl } from "../core/domain/url";
import "../ui/global.css";

/** Folga em volta do card, para a sombra não ser cortada pelo iframe. */
const POPOVER_PADDING = 24;

/** Fração da tela real que o card pode ocupar, no máximo. */
const MAX_SCREEN_FRACTION = 0.8;

/**
 * Mantém o popover do tamanho do card, e o card dentro da tela real.
 *
 * DUAS ARMADILHAS, as duas já causaram bug:
 *
 * 1. O popover fixo em 620×700 deixa, num token pequeno, uma faixa de iframe
 *    TRANSPARENTE em volta que intercepta cliques destinados ao mapa.
 *
 * 2. O teto do card não pode vir de `vh`. Dentro do popover, `vh` mede o
 *    próprio iframe — que encolhemos a partir do card. O card encolhia, o teto
 *    encolhia junto, e a imagem nunca mais cabia: a janela ficava cortada num
 *    talo. O teto vem de `OBR.viewport`, a janela real do Owlbear.
 */
function usePopoverAutoSize() {
  const lastSent = useRef({ width: 0, height: 0 });
  const [maxSize, setMaxSize] = useState<{ width: number; height: number }>();

  useEffect(() => {
    let active = true;
    getScreenSize()
      .then((screen) => {
      if (!active) return;
      setMaxSize({
        // Nunca abaixo do `min-width` do card (340 px): numa tela estreita o
        // teto ficaria menor que o piso e o conteúdo transbordaria.
        width: Math.max(340, Math.min(600, screen.width - POPOVER_PADDING * 2)),
        height: Math.max(
          240,
          Math.round(screen.height * MAX_SCREEN_FRACTION),
        ),
      });
      })
      // Sem os tetos, o card usa o fallback em pixels do CSS: degrada, não
      // quebra. Não vale derrubar nada por causa disso.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const frame = useRef<number>();
  const pending = useRef<{ width: number; height: number }>();

  // Limpa o quadro agendado se o componente sair antes dele rodar.
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /**
   * O `ResizeObserver` dispara várias vezes durante um mesmo layout — a imagem
   * carregando, o zoom abrindo, a janela do Owlbear sendo arrastada. Cada
   * disparo custava DUAS chamadas de IPC (`setWidth` + `setHeight`) para o
   * iframe pai.
   *
   * Agrupamos por quadro de animação: só o último tamanho de cada quadro é
   * enviado. Uma rajada de 30 disparos vira 1 envio.
   */
  const onResize = useCallback((size: { width: number; height: number }) => {
    pending.current = {
      width: size.width + POPOVER_PADDING,
      height: size.height + POPOVER_PADDING,
    };
    if (frame.current !== undefined) return; // já há um quadro agendado

    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      const next = pending.current;
      if (!next) return;
      const last = lastSent.current;
      // Limiar para uma diferença de 1 px não realimentar o ResizeObserver.
      if (
        Math.abs(next.width - last.width) < 4 &&
        Math.abs(next.height - last.height) < 4
      ) {
        return;
      }
      lastSent.current = next;
      void resizeHandoutPopover(next.width, next.height);
    });
  }, []);

  return { onResize, maxSize };
}

function App() {
  const params = new URLSearchParams(window.location.search);
  // A URL vem da query string, que chega tanto do mestre quanto de um
  // broadcast. Sanitizar aqui é a última barreira antes do `<img src>`.
  const imageUrl = sanitizeImageUrl(params.get("src"));
  const titleFromUrl = params.get("title") ?? "Sem título";

  const { loading, isGM, error, findByUrl, saveHandout } = useHandouts();
  const { onResize, maxSize } = usePopoverAutoSize();

  if (loading) return null;

  if (!imageUrl) {
    return (
      <HandoutModal
        title="Handout indisponível"
        imageUrl=""
        description=""
        notes=""
        sharedWithPlayers={false}
        canEdit={false}
        onResize={onResize}
        maxSize={maxSize}
        onClose={closeHandoutPopover}
      />
    );
  }

  // O registro só existe se este handout estiver liberado ou anotado. Quando
  // não existe, montamos um em memória a partir da URL — ele só passa a ocupar
  // espaço se o mestre liberar ou escrever algo.
  const handout = findByUrl(imageUrl) ?? untrackedHandout(imageUrl, titleFromUrl);

  /**
   * O botão único que alterna. Cada lado faz DUAS coisas:
   *
   *   Liberar  = grava sharedWithPlayers:true  (entra na lista do jogador)
   *            + broadcast de "mostrar"        (abre na tela dele agora)
   *
   *   Retirar  = grava sharedWithPlayers:false (some da lista; se não houver
   *                                             anotação, o registro é podado)
   *            + broadcast de "esconder"       (fecha o que estiver aberto)
   */
  async function handleToggleShare() {
    const nextShared = !handout.sharedWithPlayers;
    const saved = await saveHandout({
      ...handout,
      sharedWithPlayers: nextShared,
    });
    // Sem gravar, não emite. Antes o broadcast saía mesmo com a escrita
    // falhando: o jogador via o handout na tela sem ele estar na lista dele —
    // e ao fechar, perdia o acesso sem entender por quê.
    if (!saved) return;

    if (nextShared) {
      await broadcastShowHandout(handout.imageUrl, handout.title);
    } else {
      await broadcastHideHandout(handout.imageUrl);
    }
  }

  return (
    <HandoutModal
      title={handout.title}
      imageUrl={handout.imageUrl}
      description={handout.description}
      notes={handout.notes}
      sharedWithPlayers={handout.sharedWithPlayers}
      canEdit={isGM}
      writeError={error}
      onResize={onResize}
      maxSize={maxSize}
      onToggleShare={isGM ? handleToggleShare : undefined}
      // >>> OBR: fecha só aqui, sem tocar na sala.
      onClose={closeHandoutPopover}
      onSave={isGM ? (patch) => saveHandout({ ...handout, ...patch }) : undefined}
      onPickImage={isGM ? pickImageFromOwlbear : undefined}
    />
  );
}

whenOwlbearReady(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
