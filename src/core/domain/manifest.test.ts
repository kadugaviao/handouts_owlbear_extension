/**
 * O `manifest.json` aponta para arquivos por caminho, em texto solto. Um
 * caminho errado não quebra a compilação nem o build: quebra em runtime, dentro
 * do Owlbear, em silêncio. Este teste amarra o manifest ao que existe de fato.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(ROOT, "public", "manifest.json"), "utf8"),
);

/**
 * Um caminho do manifest existe? Pode ser um arquivo estático de `public/`,
 * uma página HTML, ou "/" (a raiz, servida por `index.html`).
 */
function resolves(path: string): boolean {
  if (path === "/") return existsSync(join(ROOT, "index.html"));
  const relative = path.replace(/^\//, "");
  return (
    existsSync(join(ROOT, "public", relative)) || existsSync(join(ROOT, relative))
  );
}

describe("manifest.json aponta para arquivos que existem", () => {
  it.each([
    ["icon", manifest.icon],
    ["action.icon", manifest.action?.icon],
    ["action.popover", manifest.action?.popover],
    ["background_url", manifest.background_url],
  ])("%s → %s", (_campo, caminho) => {
    expect(typeof caminho).toBe("string");
    expect(resolves(caminho as string)).toBe(true);
  });
});

describe("manifest.json respeita os limites do Owlbear", () => {
  it("name até 45 caracteres", () => {
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(manifest.name.length).toBeLessThanOrEqual(45);
  });

  it("description até 128 caracteres", () => {
    expect(manifest.description.length).toBeLessThanOrEqual(128);
  });

  it("declara manifest_version", () => {
    expect(manifest.manifest_version).toBe(1);
  });

  it("só usa nomes de permissão que o Owlbear aceita", () => {
    const validas = new Set([
      "clipboard-write",
      "clipboard-read",
      "autoplay",
      "bluetooth",
      "camera",
      "microphone",
      "usb",
      "display-capture",
      "hid",
    ]);
    for (const p of manifest.permissions ?? []) {
      expect(validas.has(p.name)).toBe(true);
      expect(p.reason?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("a URL do popover do handout casa com a página que existe", () => {
  it("client.ts aponta para a mesma página que o build gera", () => {
    const client = readFileSync(
      join(ROOT, "src", "core", "owlbear", "client.ts"),
      "utf8",
    );
    const match = client.match(/return `(\/[^?`]+)\?/);
    expect(match).not.toBeNull();
    expect(resolves(match![1])).toBe(true);
  });
});
