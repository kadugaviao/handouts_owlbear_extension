/**
 * Entrada do popover da ACTION (o ícone na barra do Owlbear): o journal.
 *
 * A lista aqui NÃO é a biblioteca de imagens — é o caderninho. Ela mostra os
 * handouts que estão liberados agora ou que o mestre anotou. A biblioteca
 * ilimitada é o gerenciador de imagens do próprio Owlbear, alcançada pelo
 * botão "Abrir da biblioteca".
 */
import { StrictMode, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { HandoutList } from "../ui/HandoutList";
import { whenOwlbearReady } from "../core/owlbear/mount";
import { useHandouts } from "../core/owlbear/useHandouts";
import {
  broadcastHideHandout,
  openHandoutLocally,
  pickImageFromOwlbear,
} from "../core/owlbear/client";
import { downloadBackup, serializeBackup } from "../core/domain/backup";
import type { Handout } from "../core/domain/handout";
import "../ui/global.css";

function App() {
  const {
    handouts,
    loading,
    isGM,
    budget,
    error,
    dismissError,
    forgetHandout,
    replaceAll,
  } = useHandouts();

  /**
   * Abre a biblioteca do Owlbear e mostra o que o mestre escolher na nossa
   * janela. Nada é gravado aqui: o handout só passa a ocupar espaço quando o
   * mestre o libera ou escreve alguma anotação.
   */
  const handleOpenFromLibrary = useCallback(async () => {
    const picked = await pickImageFromOwlbear();
    if (!picked) return;
    await openHandoutLocally(picked.url, picked.name || "Sem título");
  }, []);

  const handleOpen = useCallback((handout: Handout) => {
    void openHandoutLocally(handout.imageUrl, handout.title);
  }, []);

  const handleRemove = useCallback(
    async (handout: Handout) => {
      // Some do caderninho. A imagem continua na biblioteca do Owlbear.
      const removed = await forgetHandout(handout.imageUrl);
      // Excluir um handout liberado precisa fechá-lo na tela de quem estiver
      // com ele aberto — igual ao "Retirar". Sem isto, o jogador ficava olhando
      // um handout que não existe mais.
      if (removed && handout.sharedWithPlayers) {
        await broadcastHideHandout(handout.imageUrl);
      }
    },
    [forgetHandout],
  );

  // A lista já chega validada e confirmada pela interface.
  const handleImport = useCallback(
    (imported: Handout[]) => replaceAll(imported),
    [replaceAll],
  );

  if (loading) return null;

  return (
    <HandoutList
      handouts={handouts}
      isGM={isGM}
      onOpen={handleOpen}
      onOpenLibrary={() => void handleOpenFromLibrary()}
      onRemove={(handout) => void handleRemove(handout)}
      budget={budget}
      writeError={error}
      onDismissError={dismissError}
      onExport={isGM ? () => downloadBackup(handouts) : undefined}
      exportText={isGM ? () => serializeBackup(handouts) : undefined}
      onImport={isGM ? handleImport : undefined}
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
