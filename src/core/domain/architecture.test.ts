/**
 * A regra de dependência entre camadas, como teste.
 *
 * Ela estava só documentada e foi violada na primeira oportunidade. Documento
 * não segura arquitetura; teste segura.
 *
 *   domain/  ←  owlbear/  ←  pages/  →  ui/
 *    (puro)      (SDK)      (junta)   (React)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// O Vitest roda a partir da raiz do projeto.
const SRC = join(process.cwd(), "src");

/** Lê os arquivos de código de uma pasta (sem testes, sem CSS, sem markdown). */
function sourceFiles(dir: string): { name: string; content: string }[] {
  return readdirSync(join(SRC, dir))
    .filter((f: string) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"))
    .map((name: string) => ({
      name: `${dir}/${name}`,
      content: readFileSync(join(SRC, dir, name), "utf8"),
    }));
}

describe("domain/ é puro", () => {
  const files = sourceFiles("core/domain");

  it("tem arquivos para verificar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("$name não importa o SDK do Owlbear", ({ content }) => {
    expect(content).not.toMatch(/from ["']@owlbear-rodeo\/sdk["']/);
  });

  it.each(files)("$name não importa React", ({ content }) => {
    expect(content).not.toMatch(/from ["']react["']/);
  });

  it.each(files)("$name não importa da camada owlbear/", ({ content }) => {
    expect(content).not.toMatch(/from ["']\.\.\/owlbear\//);
  });
});

describe("ui/ não conhece o Owlbear", () => {
  const files = sourceFiles("ui");

  it("tem arquivos para verificar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("$name não importa o SDK do Owlbear", ({ content }) => {
    expect(content).not.toMatch(/from ["']@owlbear-rodeo\/sdk["']/);
  });

  // Importar utilitário puro de `domain/` é permitido: não acopla a interface
  // ao Owlbear, que é a restrição que realmente importa. O proibido é alcançar
  // a camada de integração.
  it.each(files)("$name não importa da camada owlbear/", ({ content }) => {
    expect(content).not.toMatch(/from ["'][^"']*core\/owlbear\//);
  });
});
