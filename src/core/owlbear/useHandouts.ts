/**
 * Persistência na metadata da SALA.
 *
 * Guardamos o MÍNIMO: só handouts liberados ou anotados (ver `isWorthStoring`).
 * A biblioteca de imagens do Owlbear é a fonte ilimitada; a metadata é só o
 * caderninho do que ela não sabe guardar.
 *
 * FILTRO DE VISIBILIDADE: para um jogador este hook devolve apenas os handouts
 * liberados, já reduzidos a título e imagem. `description` e `notes` são
 * descartados aqui, na fronteira — os componentes de UI num cliente de jogador
 * nunca chegam a segurar esses campos.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OBR, { type Metadata } from "@owlbear-rodeo/sdk";
import { HANDOUTS_METADATA_KEY } from "./constants";
import {
  isWorthStoring,
  parseHandout,
  toPlayerHandout,
  type Handout,
} from "../domain/handout";
import {
  checkBudget,
  EMPTY_BUDGET,
  MetadataBudgetError,
  type BudgetStatus,
} from "../domain/limits";

function readHandouts(metadata: Metadata): Handout[] {
  const raw = metadata[HANDOUTS_METADATA_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.map(parseHandout).filter((h): h is Handout => h !== null);
}

async function writeHandouts(handouts: Handout[]): Promise<void> {
  // Poda antes de gravar: um handout que não está liberado nem tem anotação
  // já é integralmente descrito pela biblioteca do Owlbear. Persistir seria
  // gastar orçamento à toa.
  const worthKeeping = handouts.filter(isWorthStoring);

  // A metadata da sala INTEIRA precisa caber em 16 kB, dividida com as outras
  // extensões. Recusar aqui, com mensagem legível, é muito melhor que deixar o
  // Owlbear rejeitar a escrita silenciosamente.
  const status = checkBudget(worthKeeping);
  if (status.exceeded) throw new MetadataBudgetError(status);

  // >>> OBR: escrita compartilhada — propaga para todos os clientes da sala.
  //
  // `setMetadata` faz um spread sobre as chaves existentes: as chaves de outras
  // extensões ficam intactas. O valor da NOSSA chave, porém, é substituído por
  // inteiro — daí o read-before-write em `mutateHandouts`.
  await OBR.room.setMetadata({ [HANDOUTS_METADATA_KEY]: worthKeeping });
}

/**
 * Lê o estado atual do servidor antes de escrever.
 *
 * Partir do estado local arriscaria apagar o handout que outro cliente acabou
 * de criar.
 */
async function mutateHandouts(
  mutate: (current: Handout[]) => Handout[],
): Promise<void> {
  const current = readHandouts(await OBR.room.getMetadata());
  await writeHandouts(mutate(current));
}

/** Estado bruto da sala. Um único ponto de assinatura do SDK. */
function useRoomHandouts() {
  const [handouts, setHandouts] = useState<Handout[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGM, setIsGM] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /**
   * Serialização da NOSSA fatia da metadata na última atualização aplicada.
   *
   * `onMetadataChange` dispara para qualquer mudança na sala, vinda de qualquer
   * extensão. Sem esta comparação, um rastreador de iniciativa escrevendo a
   * cada turno nos fazia reparsear a lista, criar um array novo, invalidar os
   * `useMemo` a jusante (o filtro de visibilidade e o `checkBudget`, que roda
   * `JSON.stringify`) e re-renderizar a árvore inteira — tudo para chegar ao
   * mesmo resultado.
   */
  const lastSlice = useRef<string>();

  useEffect(() => {
    let active = true;

    /** Aplica a mudança só se a nossa fatia realmente mudou. */
    function applyIfChanged(metadata: Metadata) {
      const slice = JSON.stringify(metadata[HANDOUTS_METADATA_KEY] ?? null);
      if (slice === lastSlice.current) return;
      lastSlice.current = slice;
      setHandouts(readHandouts(metadata));
    }

    // >>> OBR: leitura inicial + papel do jogador.
    //
    // O `catch` não é decorativo: sem ele, uma falha aqui deixava `loading`
    // em `true` para sempre e a extensão ficava numa tela em branco, sem
    // mensagem e sem log — impossível de diagnosticar.
    Promise.all([OBR.room.getMetadata(), OBR.player.getRole()])
      .then(([metadata, role]) => {
        if (!active) return;
        applyIfChanged(metadata);
        setIsGM(role === "GM");
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setLoadError(
          e instanceof Error
            ? `Não foi possível ler o journal da sala: ${e.message}`
            : "Não foi possível ler o journal da sala.",
        );
      })
      .finally(() => {
        // Sai do estado de carregamento nos dois caminhos.
        if (active) setLoading(false);
      });

    // >>> OBR: assinaturas reativas.
    const unsubscribeMetadata = OBR.room.onMetadataChange(applyIfChanged);
    const unsubscribePlayer = OBR.player.onChange((player) => {
      setIsGM(player.role === "GM");
    });

    return () => {
      active = false;
      unsubscribeMetadata();
      unsubscribePlayer();
    };
  }, []);

  return { handouts, loading, isGM, loadError };
}

export interface UseHandouts {
  /** Já filtrado pelo papel: o jogador só recebe os liberados, sem textos. */
  handouts: Handout[];
  loading: boolean;
  isGM: boolean;
  /** Quanto do orçamento da sala o caderninho já ocupa. */
  budget: BudgetStatus;
  /** Última falha de escrita, em português. `null` quando está tudo certo. */
  error: string | null;
  dismissError: () => void;
  /** Busca o registro de uma imagem da biblioteca, se houver. */
  findByUrl: (imageUrl: string) => Handout | undefined;
  /**
   * Grava (ou apaga) o registro de um handout. A poda é automática: se ele
   * deixar de estar liberado e de ter anotações, o registro some sozinho.
   */
  saveHandout: (handout: Handout) => Promise<boolean>;
  /** Remove o registro explicitamente (a imagem continua na biblioteca). */
  forgetHandout: (imageUrl: string) => Promise<boolean>;
  /** Substitui a lista inteira — usado pela importação de backup. */
  replaceAll: (handouts: Handout[]) => Promise<boolean>;
}

export function useHandouts(): UseHandouts {
  const { handouts: raw, loading, isGM, loadError } = useRoomHandouts();
  const [writeError, setWriteError] = useState<string | null>(null);
  // Falha de leitura e falha de escrita aparecem no mesmo lugar da interface.
  const error = writeError ?? loadError;

  /**
   * Converte falha de escrita em mensagem legível em vez de rejeição solta.
   *
   * Devolve `true` só quando gravou. Quem chama PRECISA olhar esse retorno: sem
   * ele, uma falha de orçamento deixava o "liberar" emitir o broadcast assim
   * mesmo (jogador via o handout fora da lista) e o "salvar" sair do modo de
   * edição jogando fora o texto digitado.
   */
  const guard = useCallback(async (op: () => Promise<void>): Promise<boolean> => {
    try {
      await op();
      setWriteError(null);
      return true;
    } catch (e) {
      setWriteError(
        e instanceof Error ? e.message : "Não foi possível salvar o journal.",
      );
      return false;
    }
  }, []);

  // ---- O FILTRO DE VISIBILIDADE ----
  const handouts = useMemo(() => {
    if (isGM) return raw;
    return raw.filter((h) => h.sharedWithPlayers).map(toPlayerHandout);
  }, [raw, isGM]);

  const findByUrl = useCallback(
    (imageUrl: string) => handouts.find((h) => h.imageUrl === imageUrl),
    [handouts],
  );

  const saveHandout = useCallback(
    async (handout: Handout): Promise<boolean> =>
      guard(() =>
        mutateHandouts((current) => {
          const rest = current.filter((h) => h.imageUrl !== handout.imageUrl);
          // `writeHandouts` poda o que não vale a pena guardar, então basta
          // colocar o registro atualizado de volta na lista.
          return [...rest, handout];
        }),
      ),
    [guard],
  );

  const forgetHandout = useCallback(
    async (imageUrl: string): Promise<boolean> =>
      guard(() =>
        mutateHandouts((current) =>
          current.filter((h) => h.imageUrl !== imageUrl),
        ),
      ),
    [guard],
  );

  const replaceAll = useCallback(
    async (next: Handout[]): Promise<boolean> => guard(() => writeHandouts(next)),
    [guard],
  );

  // O orçamento é medido sobre a lista COMPLETA da sala, não sobre a versão
  // filtrada que um jogador enxerga.
  //
  // Só o mestre escreve e só ele vê a barra, então para um jogador isto seria
  // um `JSON.stringify` da lista inteira a cada mudança, para um número que
  // ninguém lê.
  const budget = useMemo(
    () => (isGM ? checkBudget(raw) : EMPTY_BUDGET),
    [raw, isGM],
  );

  return {
    handouts,
    loading,
    isGM,
    budget,
    error,
    dismissError: () => setWriteError(null),
    findByUrl,
    saveHandout,
    forgetHandout,
    replaceAll,
  };
}
