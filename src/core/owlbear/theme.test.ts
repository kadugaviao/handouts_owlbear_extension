import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    theme: { getTheme: vi.fn(), onChange: vi.fn() },
  },
}));

import OBR from "@owlbear-rodeo/sdk";
import { onOwlbearThemeChange, readOwlbearMode } from "./theme";

const theme = vi.mocked(OBR.theme);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("readOwlbearMode", () => {
  it.each([
    ["DARK", "dark"],
    ["LIGHT", "light"],
  ])("traduz mode %s do SDK para %s", async (doSdk, nosso) => {
    theme.getTheme.mockResolvedValue({ mode: doSdk } as never);
    await expect(readOwlbearMode()).resolves.toBe(nosso);
  });

  /**
   * O B22 foi exatamente isto: uma leitura cosmética do SDK que rejeitava numa
   * sala sem cena e derrubava a extensão inteira. Tema é ainda mais cosmético
   * que posição de janela — não pode derrubar nada.
   */
  it("devolve null quando o SDK recusa, em vez de rejeitar", async () => {
    theme.getTheme.mockRejectedValue({
      name: "MissingDataError",
      message: "No scene found",
    });
    await expect(readOwlbearMode()).resolves.toBeNull();
  });

  it("devolve null diante de uma resposta que não reconhece", async () => {
    theme.getTheme.mockResolvedValue({ mode: "SEPIA" } as never);
    await expect(readOwlbearMode()).resolves.toBeNull();
  });
});

describe("onOwlbearThemeChange", () => {
  it("avisa o modo novo quando o usuário troca o tema no Owlbear", () => {
    const parar = vi.fn();
    theme.onChange.mockReturnValue(parar);
    const aviso = vi.fn();

    onOwlbearThemeChange(aviso);
    // O SDK chama o callback registrado; simulamos o Owlbear mudando para claro.
    theme.onChange.mock.calls[0][0]({ mode: "LIGHT" } as never);

    expect(aviso).toHaveBeenCalledWith("light");
  });

  it("ignora um tema que não sabe traduzir, sem derrubar o listener", () => {
    theme.onChange.mockReturnValue(vi.fn());
    const aviso = vi.fn();

    onOwlbearThemeChange(aviso);
    theme.onChange.mock.calls[0][0]({ mode: "SEPIA" } as never);

    expect(aviso).not.toHaveBeenCalled();
  });

  it("devolve a função de cancelamento do SDK", () => {
    const parar = vi.fn();
    theme.onChange.mockReturnValue(parar);
    expect(onOwlbearThemeChange(vi.fn())).toBe(parar);
  });

  /** Fora do Owlbear o `onChange` nem existe: a página não pode quebrar. */
  it("devolve um cancelamento inofensivo quando o SDK recusa registrar", () => {
    theme.onChange.mockImplementation(() => {
      throw new Error("sem SDK");
    });
    const parar = onOwlbearThemeChange(vi.fn());
    expect(() => parar()).not.toThrow();
  });
});
