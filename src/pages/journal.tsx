/**
 * Entrada do popover da ACTION (o ícone na barra do Owlbear): o journal.
 *
 * A lista aqui NÃO é a biblioteca de imagens — é o caderninho. Ela mostra os
 * handouts que estão liberados agora ou que o mestre anotou. A biblioteca
 * ilimitada é o gerenciador de imagens do próprio Owlbear, alcançada pelo
 * botão "Abrir da biblioteca".
 */
import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { HandoutList } from "../ui/HandoutList";
import { whenOwlbearReady } from "../core/owlbear/mount";
import { useHandouts } from "../core/owlbear/useHandouts";
import {
  broadcastHideHandout,
  describeSdkError,
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
   * Falha de uma AÇÃO (abrir a biblioteca, abrir a janela), separada da falha
   * de escrita que já vem do hook.
   *
   * Estas ações eram as únicas da extensão sem retorno nenhum: um `void
   * promessa()` descartava a rejeição do SDK e o mestre clicava no botão sem
   * receber a janela nem um aviso. Foi assim que `MissingDataError: No scene
   * found` ficou escondido — só aparecia no console do navegador.
   */
  const [actionError, setActionError] = useState<string | null>(null);

  /** Guarda a falha com contexto: o texto sozinho não diz qual passo quebrou. */
  const report = useCallback((contexto: string, e: unknown) => {
    const detalhe = describeSdkError(e);
    setActionError(detalhe ? `${contexto} (${detalhe})` : contexto);
  }, []);

  /**
   * Abre a biblioteca do Owlbear e mostra o que o mestre escolher na nossa
   * janela. Nada é gravado aqui: o handout só passa a ocupar espaço quando o
   * mestre o libera ou escreve alguma anotação.
   *
   * Os dois passos têm `catch` separados de propósito — a mensagem precisa
   * dizer QUAL deles falhou.
   */
  const handleOpenFromLibrary = useCallback(async () => {
    setActionError(null);
    let picked: Awaited<ReturnType<typeof pickImageFromOwlbear>>;
    try {
      picked = await pickImageFromOwlbear();
    } catch (e) {
      report("Não foi possível abrir a biblioteca de imagens do Owlbear.", e);
      return;
    }
    if (!picked) return; // o mestre fechou sem escolher
    try {
      await openHandoutLocally(picked.url, picked.name || "Sem título");
    } catch (e) {
      report("Não foi possível abrir a janela do handout.", e);
    }
  }, [report]);

  const handleOpen = useCallback(
    async (handout: Handout) => {
      setActionError(null);
      try {
        await openHandoutLocally(handout.imageUrl, handout.title);
      } catch (e) {
        report("Não foi possível abrir a janela do handout.", e);
      }
    },
    [report],
  );

  const handleRemove = useCallback(
    async (handout: Handout) => {
      setActionError(null);
      // Some do caderninho. A imagem continua na biblioteca do Owlbear.
      const removed = await forgetHandout(handout.imageUrl);
      // Excluir um handout liberado precisa fechá-lo na tela de quem estiver
      // com ele aberto — igual ao "Retirar". Sem isto, o jogador ficava olhando
      // um handout que não existe mais.
      if (removed && handout.sharedWithPlayers) {
        try {
          await broadcastHideHandout(handout.imageUrl);
        } catch (e) {
          report("O handout saiu da lista, mas continua na tela dos jogadores.", e);
        }
      }
    },
    [forgetHandout, report],
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
      onOpen={(handout) => void handleOpen(handout)}
      onOpenLibrary={() => void handleOpenFromLibrary()}
      onRemove={(handout) => void handleRemove(handout)}
      budget={budget}
      writeError={actionError ?? error}
      onDismissError={() => {
        setActionError(null);
        dismissError();
      }}
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
