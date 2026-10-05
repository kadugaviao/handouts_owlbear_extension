/**
 * A regra de resolução do tema.
 *
 * Três entradas (o que o usuário escolheu, o que o Owlbear está usando, e o que
 * sobrou no armazenamento) viram um modo só. É lógica pura, então mora aqui —
 * e é testável sem SDK e sem navegador.
 */
import { describe, expect, it } from "vitest";
import { parsePreference, resolveTheme } from "./theme";

describe("resolveTheme — automático acompanha o Owlbear", () => {
  it.each([
    ["dark" as const, "dark"],
    ["light" as const, "light"],
  ])("anfitrião em %s → extensão em %s", (anfitriao, esperado) => {
    expect(resolveTheme("auto", anfitriao)).toBe(esperado);
  });

  // Acontece de verdade: a página abre antes do `getTheme()` responder, e em
  // qualquer falha do SDK. Escuro porque é o padrão do Owlbear — abrir branco
  // dentro de uma interface escura é a pior das duas opções.
  it("sem saber o do anfitrião, assume escuro", () => {
    expect(resolveTheme("auto", null)).toBe("dark");
  });
});

describe("resolveTheme — a escolha explícita vence o anfitrião", () => {
  it.each([
    ["light" as const, "dark" as const, "light"],
    ["dark" as const, "light" as const, "dark"],
    ["light" as const, null, "light"],
    ["dark" as const, null, "dark"],
  ])(
    "preferência %s com anfitrião %s → %s",
    (preferencia, anfitriao, esperado) => {
      expect(resolveTheme(preferencia, anfitriao)).toBe(esperado);
    },
  );
});

describe("parsePreference — o que vem do localStorage não é confiável", () => {
  it.each(["auto", "light", "dark"])("aceita %s", (valor) => {
    expect(parsePreference(valor)).toBe(valor);
  });

  // O usuário pode editar; outra versão da extensão pode ter gravado outra
  // coisa; o navegador pode devolver null. Nada disso pode derrubar a página.
  it.each([null, undefined, "", "DARK", "escuro", 1, {}, []])(
    "cai em auto diante de %s",
    (valor) => {
      expect(parsePreference(valor)).toBe("auto");
    },
  );
});
