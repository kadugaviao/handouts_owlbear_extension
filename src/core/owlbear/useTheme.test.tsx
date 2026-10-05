// @vitest-environment jsdom
/**
 * O hook `useTheme` — onde as três fontes (escolha do usuário, tema do
 * Owlbear, armazenamento) viram um `data-theme` na raiz do documento.
 *
 * A regra de resolução já é testada em `domain/theme.test.ts`, sem navegador.
 * O que se testa aqui é a ligação: ler o anfitrião, reagir à troca, persistir,
 * e sobreviver a um `localStorage` bloqueado — que é o caso real de um iframe
 * com cookies de terceiro barrados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    theme: { getTheme: vi.fn(), onChange: vi.fn() },
  },
}));

import OBR from "@owlbear-rodeo/sdk";
import { useTheme } from "./theme";

const theme = vi.mocked(OBR.theme);
const CHAVE = "obr-handouts:theme";

afterEach(cleanup);

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  theme.getTheme.mockResolvedValue({ mode: "DARK" } as never);
  theme.onChange.mockReturnValue(vi.fn());
});

describe("aplica o tema na raiz do documento", () => {
  it("escreve data-theme com o modo do Owlbear", async () => {
    theme.getTheme.mockResolvedValue({ mode: "LIGHT" } as never);
    renderHook(() => useTheme());
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light"),
    );
  });

  it("reage quando o usuário troca o tema dentro do Owlbear", async () => {
    renderHook(() => useTheme());
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));

    act(() => {
      theme.onChange.mock.calls[0][0]({ mode: "LIGHT" } as never);
    });
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("a escolha explícita vence e persiste", () => {
  it("ignora o anfitrião depois que o usuário escolhe", async () => {
    theme.getTheme.mockResolvedValue({ mode: "DARK" } as never);
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.mode).toBe("dark"));

    act(() => result.current.setPreference("light"));

    expect(result.current.mode).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(CHAVE)).toBe("light");
  });

  it("começa pela preferência gravada, sem esperar o SDK", () => {
    localStorage.setItem(CHAVE, "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("light");
    expect(result.current.mode).toBe("light");
  });

  it("volta a acompanhar o Owlbear ao escolher automático", async () => {
    localStorage.setItem(CHAVE, "light");
    theme.getTheme.mockResolvedValue({ mode: "DARK" } as never);
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference("auto"));
    await waitFor(() => expect(result.current.mode).toBe("dark"));
  });
});

describe("a janela do handout acompanha o painel", () => {
  /**
   * São iframes separados. Sem o evento `storage`, trocar o tema no painel
   * deixaria uma janela aberta no tema antigo.
   */
  it("o evento storage de outro documento troca o tema aqui", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.mode).toBe("dark"));

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: CHAVE, newValue: "light" }),
      );
    });
    expect(result.current.mode).toBe("light");
  });

  it("ignora mudança de outra chave na mesma origem", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.mode).toBe("dark"));

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "outra-extensao", newValue: "light" }),
      );
    });
    expect(result.current.mode).toBe("dark");
  });
});

describe("armazenamento bloqueado não derruba a janela", () => {
  it("escolher um tema continua funcionando sem localStorage", async () => {
    const erro = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("bloqueado");
    });

    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.mode).toBe("dark"));

    expect(() => act(() => result.current.setPreference("light"))).not.toThrow();
    expect(result.current.mode).toBe("light");
    erro.mockRestore();
  });

  it("o SDK recusando o tema não impede a janela de abrir", async () => {
    theme.getTheme.mockRejectedValue({
      name: "MissingDataError",
      message: "No scene found",
    });
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.mode).toBe("dark"));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
