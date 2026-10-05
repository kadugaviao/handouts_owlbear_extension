/**
 * O contrato dos tokens de tema, como teste.
 *
 * Um token semântico definido só num dos temas é o bug clássico de tema escuro:
 * funciona na hora de escrever, e some ou fica ilegível no outro modo — onde
 * ninguém olha. Isso não aparece na compilação nem na suíte de componente,
 * porque CSS não tem tipo.
 *
 * Mora em `ui/` porque é sobre a folha de estilo, e lê o arquivo como texto:
 * `global.css` não é importável num teste de `node`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(process.cwd(), "src", "ui", "global.css"), "utf8");

/**
 * Os tokens que a camada 2 promete (ver `documents/design.md`, §3).
 *
 * Esta lista é o contrato: um componente pode usar qualquer um deles contando
 * que exista nos dois temas.
 */
const SEMANTICOS = [
  "--bg",
  "--surface",
  "--surface-raised",
  "--line",
  "--text-1",
  "--text-2",
  "--text-3",
  "--accent",
  "--accent-ink",
  "--gold",
  "--danger",
  "--danger-ink",
  "--ring",
];

/** O corpo de um seletor, ou string vazia se ele não existir. */
function bloco(seletor: string): string {
  const i = CSS.indexOf(seletor);
  if (i === -1) return "";
  const abre = CSS.indexOf("{", i);
  const fecha = CSS.indexOf("}", abre);
  return CSS.slice(abre + 1, fecha);
}

const claro = bloco('[data-theme="light"]');
const escuro = bloco(":root");

describe("os dois temas existem", () => {
  it.each([
    [":root (escuro, o padrão)", ":root"],
    ['[data-theme="light"]', '[data-theme="light"]'],
  ])("%s está declarado", (_nome, seletor) => {
    expect(bloco(seletor).trim().length).toBeGreaterThan(0);
  });
});

describe("todo token semântico existe nos DOIS temas", () => {
  it.each(SEMANTICOS)("%s no escuro", (token) => {
    expect(escuro).toContain(`${token}:`);
  });

  it.each(SEMANTICOS)("%s no claro", (token) => {
    expect(claro).toContain(`${token}:`);
  });
});

describe("a camada semântica não repete cor crua", () => {
  // Um hex direto num token semântico significa que a camada 1 foi pulada —
  // e é assim que uma cor passa a existir em dois lugares e divergir.
  it.each(SEMANTICOS)("%s aponta para uma primitiva, não para um hex", (token) => {
    for (const tema of [escuro, claro]) {
      const linha = tema.split("\n").find((l) => l.trim().startsWith(`${token}:`));
      if (!linha) continue;
      expect(linha).toMatch(/var\(--/);
    }
  });
});

describe("o sistema respeita quem pediu menos movimento", () => {
  it("declara um bloco de prefers-reduced-motion", () => {
    expect(CSS).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});

describe("o navegador sabe em que tema está", () => {
  // Sem `color-scheme`, a barra de rolagem e os controles nativos continuam
  // claros dentro de um painel escuro.
  it("declara color-scheme nos dois temas", () => {
    expect(escuro).toMatch(/color-scheme:\s*dark/);
    expect(claro).toMatch(/color-scheme:\s*light/);
  });
});
