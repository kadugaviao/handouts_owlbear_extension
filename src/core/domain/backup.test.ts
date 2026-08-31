import { describe, expect, it } from "vitest";
import { parseBackup, serializeBackup, EXPORT_FORMAT_VERSION } from "./backup";
import type { Handout } from "./handout";

const handout: Handout = {
  imageUrl: "https://images.owlbear.rodeo/a.png",
  title: "Goblin",
  description: "verde",
  notes: "morde",
  sharedWithPlayers: true,
};

describe("ida e volta", () => {
  it("preserva os handouts", () => {
    expect(parseBackup(serializeBackup([handout]))).toEqual([handout]);
  });
});

describe("parseBackup rejeita entrada inválida", () => {
  it("recusa JSON malformado", () => {
    expect(() => parseBackup("{ nao é json")).toThrow(/JSON válido/);
  });

  it("recusa JSON sem lista de handouts", () => {
    expect(() => parseBackup('{"foo":1}')).toThrow(/lista de handouts/);
  });

  it("recusa arquivo sem nenhum handout aproveitável", () => {
    expect(() => parseBackup('{"handouts":[{"sem":"imagem"}]}')).toThrow(
      /aproveitável/,
    );
  });

  it("recusa um formato mais novo que o suportado", () => {
    const futuro = JSON.stringify({
      version: EXPORT_FORMAT_VERSION + 1,
      handouts: [handout],
    });
    expect(() => parseBackup(futuro)).toThrow(/Atualize a extensão/);
  });

  it("descarta handout com URL de esquema perigoso", () => {
    const malicioso = JSON.stringify({
      handouts: [handout, { ...handout, imageUrl: "javascript:alert(1)" }],
    });
    expect(parseBackup(malicioso)).toEqual([handout]);
  });
});

describe("aceita um array cru, para arquivo editado à mão", () => {
  it("lê a lista direto", () => {
    expect(parseBackup(JSON.stringify([handout]))).toEqual([handout]);
  });
});
