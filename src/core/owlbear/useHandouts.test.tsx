// @vitest-environment jsdom
/**
 * A ordem de chegada das respostas do SDK.
 *
 * O hook pede a metadata (assíncrono) e registra a assinatura (síncrono) no
 * mesmo efeito. Nada garante qual chega primeiro — e a resposta do pedido
 * carrega o estado de QUANDO foi pedida, não de quando chega.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    room: {
      getMetadata: vi.fn(),
      setMetadata: vi.fn(),
      onMetadataChange: vi.fn(),
    },
    player: { getRole: vi.fn(), onChange: vi.fn() },
  },
}));

import OBR from "@owlbear-rodeo/sdk";
import { useHandouts } from "./useHandouts";
import { HANDOUTS_METADATA_KEY } from "./constants";

const room = vi.mocked(OBR.room);
const player = vi.mocked(OBR.player);

const LIBERADO = {
  imageUrl: "https://images.owlbear.rodeo/token1.png",
  title: "Token 1",
  description: "",
  notes: "",
  sharedWithPlayers: true,
};

/** Metadata da sala com a nossa fatia. */
const comHandout = { [HANDOUTS_METADATA_KEY]: [LIBERADO] };
const vazia = {};

afterEach(cleanup);

beforeEach(() => {
  vi.resetAllMocks();
  room.onMetadataChange.mockReturnValue(vi.fn());
  player.onChange.mockReturnValue(vi.fn());
  player.getRole.mockResolvedValue("PLAYER");
});

describe("uma resposta atrasada não apaga o que já chegou", () => {
  /**
   * O CASO RELATADO EM USO REAL. O jogador abre o caderninho no mesmo instante
   * em que o mestre libera:
   *
   *   1. o hook pede a metadata — a sala ainda não tem nada
   *   2. o mestre libera; o evento de mudança chega e preenche a lista
   *   3. a resposta do passo 1 chega ATRASADA, com o estado velho
   *
   * Sem guarda, o passo 3 apaga o passo 2 — e o jogador vê "o mestre ainda não
   * liberou nenhum handout" com o handout aberto na própria tela.
   */
  it("o evento ao vivo vence a leitura inicial que chega depois", async () => {
    let responderLeituraInicial!: (m: unknown) => void;
    room.getMetadata.mockReturnValue(
      new Promise((resolve) => {
        responderLeituraInicial = resolve;
      }) as never,
    );

    const { result } = renderHook(() => useHandouts());

    // 2. O mestre libera: o evento chega antes da resposta do pedido.
    await act(async () => {
      room.onMetadataChange.mock.calls[0][0](comHandout as never);
    });
    expect(result.current.handouts).toHaveLength(1);

    // 3. A resposta atrasada chega com o estado de ANTES da liberação.
    await act(async () => {
      responderLeituraInicial(vazia);
    });

    expect(result.current.handouts).toHaveLength(1);
    expect(result.current.handouts[0].imageUrl).toBe(LIBERADO.imageUrl);
  });

  it("sem evento nenhum, a leitura inicial continua valendo", async () => {
    room.getMetadata.mockResolvedValue(comHandout as never);
    const { result } = renderHook(() => useHandouts());
    await waitFor(() => expect(result.current.handouts).toHaveLength(1));
  });

  it("uma mudança posterior do mestre continua chegando", async () => {
    room.getMetadata.mockResolvedValue(vazia as never);
    const { result } = renderHook(() => useHandouts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.handouts).toHaveLength(0);

    await act(async () => {
      room.onMetadataChange.mock.calls[0][0](comHandout as never);
    });
    expect(result.current.handouts).toHaveLength(1);
  });

  it("o mestre retirando esvazia a lista do jogador", async () => {
    room.getMetadata.mockResolvedValue(comHandout as never);
    const { result } = renderHook(() => useHandouts());
    await waitFor(() => expect(result.current.handouts).toHaveLength(1));

    await act(async () => {
      room.onMetadataChange.mock.calls[0][0](vazia as never);
    });
    expect(result.current.handouts).toHaveLength(0);
  });
});

describe("o papel do jogador filtra a lista", () => {
  it("o jogador não recebe o que não foi liberado", async () => {
    room.getMetadata.mockResolvedValue({
      [HANDOUTS_METADATA_KEY]: [
        { ...LIBERADO, sharedWithPlayers: false, notes: "segredo" },
      ],
    } as never);

    const { result } = renderHook(() => useHandouts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.handouts).toHaveLength(0);
  });

  it("o mestre recebe tudo, com os textos", async () => {
    player.getRole.mockResolvedValue("GM");
    room.getMetadata.mockResolvedValue({
      [HANDOUTS_METADATA_KEY]: [
        { ...LIBERADO, sharedWithPlayers: false, notes: "segredo" },
      ],
    } as never);

    const { result } = renderHook(() => useHandouts());
    await waitFor(() => expect(result.current.isGM).toBe(true));
    expect(result.current.handouts).toHaveLength(1);
    expect(result.current.handouts[0].notes).toBe("segredo");
  });
});
