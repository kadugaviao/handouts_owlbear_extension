/**
 * Testes da camada de comunicação com o Owlbear.
 *
 * O SDK entra dublado: o que se verifica aqui é o CONTRATO que `client.ts`
 * estabelece com ele — quais chamadas faz, com que argumentos, e sobretudo o
 * que acontece quando o Owlbear RECUSA uma delas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    viewport: { getWidth: vi.fn(), getHeight: vi.fn() },
    popover: { open: vi.fn() },
  },
}));

import OBR from "@owlbear-rodeo/sdk";
import { describeSdkError, openHandoutLocally } from "./client";
import { HANDOUT_POPOVER_ID } from "./constants";

const viewport = vi.mocked(OBR.viewport);
const popover = vi.mocked(OBR.popover);

/**
 * A resposta real do Owlbear numa sala sem cena ativa, copiada do console.
 * `OBR.viewport` é a janela DA CENA: sem cena, não há o que medir.
 */
const NO_SCENE = { name: "MissingDataError", message: "No scene found" };

const IMAGE = "https://images.owlbear.rodeo/abc.png";

/** O único argumento entregue ao `OBR.popover.open`. */
function openedWith() {
  expect(popover.open).toHaveBeenCalledTimes(1);
  return popover.open.mock.calls[0][0];
}

beforeEach(() => {
  vi.resetAllMocks();
  popover.open.mockResolvedValue(undefined);
});

describe("openHandoutLocally", () => {
  it("leva imagem e título na própria URL", async () => {
    viewport.getWidth.mockResolvedValue(1000);
    viewport.getHeight.mockResolvedValue(800);

    await openHandoutLocally(IMAGE, "Carta do Rei");

    const { searchParams } = new URL(openedWith().url, "https://exemplo.test");
    expect(searchParams.get("src")).toBe(IMAGE);
    expect(searchParams.get("title")).toBe("Carta do Rei");
  });

  it("centraliza a janela no meio do viewport quando há cena", async () => {
    viewport.getWidth.mockResolvedValue(1000);
    viewport.getHeight.mockResolvedValue(800);

    await openHandoutLocally(IMAGE, "Mapa");

    expect(openedWith()).toMatchObject({
      id: HANDOUT_POPOVER_ID,
      anchorReference: "POSITION",
      anchorPosition: { left: 500, top: 400 },
    });
  });

  /**
   * A REGRESSÃO QUE ESTE ARQUIVO EXISTE PARA IMPEDIR.
   *
   * Numa sala sem cena, `OBR.viewport` rejeita. Esses números servem só para
   * centralizar a janela — informação cosmética. Deixar a rejeição subir
   * derrubava a abertura inteira, e em silêncio: nem a biblioteca, nem a lista,
   * nem o handout recebido de outro jogador abriam.
   */
  it("abre a janela mesmo sem cena ativa", async () => {
    viewport.getWidth.mockRejectedValue(NO_SCENE);
    viewport.getHeight.mockRejectedValue(NO_SCENE);

    await expect(openHandoutLocally(IMAGE, "Mapa")).resolves.toBeUndefined();

    expect(openedWith()).toMatchObject({ id: HANDOUT_POPOVER_ID, url: expect.any(String) });
  });

  it("não inventa uma posição quando o viewport é desconhecido", async () => {
    viewport.getWidth.mockRejectedValue(NO_SCENE);
    viewport.getHeight.mockRejectedValue(NO_SCENE);

    await openHandoutLocally(IMAGE, "Mapa");

    // Sem coordenadas confiáveis, deixamos o Owlbear posicionar. Chutar um
    // ponto colocaria a janela fora da tela.
    expect(openedWith().anchorPosition).toBeUndefined();
    expect(openedWith().anchorReference).toBeUndefined();
  });

  it("propaga a falha quando é o próprio popover que recusa abrir", async () => {
    viewport.getWidth.mockResolvedValue(1000);
    viewport.getHeight.mockResolvedValue(800);
    popover.open.mockRejectedValue(new Error("recusado"));

    // Aqui não há degradação possível: quem chamou precisa saber.
    await expect(openHandoutLocally(IMAGE, "Mapa")).rejects.toThrow("recusado");
  });
});

describe("describeSdkError", () => {
  /**
   * O caso que motivou a função: o Owlbear rejeita com um objeto simples, não
   * com `Error`. Um `e instanceof Error` devolvia string vazia e a interface
   * mostrava a falha sem dizer qual era.
   */
  it("lê a mensagem do objeto cru que o Owlbear rejeita", () => {
    expect(describeSdkError(NO_SCENE)).toBe("No scene found");
  });

  it("lê a mensagem de um Error comum", () => {
    expect(describeSdkError(new Error("deu ruim"))).toBe("deu ruim");
  });

  it.each([null, undefined, "texto solto", 42, {}, { message: 7 }])(
    "devolve string vazia para %s, sem quebrar",
    (valor) => {
      expect(describeSdkError(valor)).toBe("");
    },
  );
});
