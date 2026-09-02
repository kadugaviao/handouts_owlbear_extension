import { describe, expect, it } from "vitest";
import {
  checkBudget,
  EMPTY_BUDGET,
  formatBytes,
  MetadataBudgetError,
  OUR_METADATA_BUDGET,
  ROOM_METADATA_LIMIT,
} from "./limits";
import type { Handout } from "./handout";

function handouts(quantidade: number, tamanhoDoTexto = 0): Handout[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    imageUrl: `https://images.owlbear.rodeo/${"a".repeat(60)}-${i}.png`,
    title: `Handout ${i}`,
    description: "x".repeat(tamanhoDoTexto),
    notes: "y".repeat(tamanhoDoTexto),
    sharedWithPlayers: true,
  }));
}

describe("orçamento", () => {
  it("reserva menos que o teto da sala, deixando espaço para outras extensões", () => {
    expect(OUR_METADATA_BUDGET).toBeLessThan(ROOM_METADATA_LIMIT);
  });

  it("uma lista vazia não consome quase nada", () => {
    const status = checkBudget([]);
    expect(status.exceeded).toBe(false);
    expect(status.warning).toBe(false);
  });

  it("não avisa nem estoura com poucos handouts", () => {
    const status = checkBudget(handouts(5));
    expect(status.exceeded).toBe(false);
    expect(status.warning).toBe(false);
  });

  it("acusa estouro quando a lista passa do orçamento", () => {
    const status = checkBudget(handouts(50, 600));
    expect(status.exceeded).toBe(true);
    expect(status.used).toBeGreaterThan(OUR_METADATA_BUDGET);
  });

  it("avisa antes de estourar", () => {
    // Cresce até cruzar o limiar de aviso sem ainda ter estourado.
    let n = 1;
    while (n < 500) {
      const status = checkBudget(handouts(n));
      if (status.warning && !status.exceeded) {
        expect(status.ratio).toBeGreaterThanOrEqual(0.75);
        return;
      }
      n++;
    }
    throw new Error("nunca houve um estado de aviso antes do estouro");
  });

  it("mede bytes UTF-8, não caracteres", () => {
    // "ç" ocupa 2 bytes em UTF-8; o orçamento é em bytes.
    const comAcento = checkBudget([{ ...handouts(1)[0], title: "çççççççççç" }]);
    const semAcento = checkBudget([{ ...handouts(1)[0], title: "aaaaaaaaaa" }]);
    expect(comAcento.used).toBeGreaterThan(semAcento.used);
  });
});

describe("MetadataBudgetError", () => {
  it("diz o que fazer, não só que falhou", () => {
    const erro = new MetadataBudgetError(checkBudget(handouts(50, 600)));
    expect(erro.message).toMatch(/Exportar/);
    expect(erro.message).toMatch(/encurte|Encurte/i);
  });
});

describe("formatBytes", () => {
  it("usa bytes abaixo de 1 kB e kB acima", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 kB");
  });
});

describe("EMPTY_BUDGET — usado no cliente do jogador", () => {
  it("nunca acusa aviso nem estouro", () => {
    expect(EMPTY_BUDGET.warning).toBe(false);
    expect(EMPTY_BUDGET.exceeded).toBe(false);
    expect(EMPTY_BUDGET.used).toBe(0);
  });

  it("tem a mesma forma que um resultado de checkBudget", () => {
    expect(Object.keys(EMPTY_BUDGET).sort()).toEqual(
      Object.keys(checkBudget([])).sort(),
    );
  });
});
