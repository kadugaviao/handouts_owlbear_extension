/**
 * Testa a invariante que sustenta a economia de memória: só handouts
 * liberados ou anotados ocupam espaço na metadata da sala.
 */
import { describe, expect, it } from "vitest";
import {
  isRevokePayload,
  isSharePayload,
  isWorthStoring,
  parseHandout,
  toPlayerHandout,
  untrackedHandout,
  visibleTo,
} from "./handout";

const IMG = "https://images.owlbear.rodeo/abc.png";

describe("isWorthStoring — a poda que torna a biblioteca ilimitada", () => {
  it("não guarda uma imagem apenas aberta da biblioteca", () => {
    expect(isWorthStoring(untrackedHandout(IMG, "Goblin"))).toBe(false);
  });

  it("guarda quando está liberado para os jogadores", () => {
    const h = { ...untrackedHandout(IMG, "Goblin"), sharedWithPlayers: true };
    expect(isWorthStoring(h)).toBe(true);
  });

  it("guarda quando tem notas", () => {
    const h = { ...untrackedHandout(IMG, "Goblin"), notes: "morde forte" };
    expect(isWorthStoring(h)).toBe(true);
  });

  it("guarda quando tem descrição", () => {
    const h = { ...untrackedHandout(IMG, "Goblin"), description: "verde" };
    expect(isWorthStoring(h)).toBe(true);
  });

  it("não se deixa enganar por espaços em branco", () => {
    const h = { ...untrackedHandout(IMG, "Goblin"), notes: "   \n  " };
    expect(isWorthStoring(h)).toBe(false);
  });
});

describe("toPlayerHandout — o corte de visibilidade", () => {
  it("apaga descrição e notas antes de chegar ao jogador", () => {
    const doMestre = {
      imageUrl: IMG,
      title: "Goblin",
      description: "segredo",
      notes: "mais segredo",
      sharedWithPlayers: true,
    };
    const doJogador = toPlayerHandout(doMestre);
    expect(doJogador.description).toBe("");
    expect(doJogador.notes).toBe("");
    expect(doJogador.title).toBe("Goblin");
    expect(doJogador.imageUrl).toBe(IMG);
  });
});

describe("visibleTo — a fronteira de privacidade", () => {
  const anotadoSemLiberar = {
    imageUrl: IMG,
    title: "Carta do vilão",
    description: "o vilão é o irmão do rei",
    notes: "revelar na sessão 8",
    sharedWithPlayers: false,
  };
  const liberado = {
    imageUrl: "https://images.owlbear.rodeo/mapa.png",
    title: "Mapa",
    description: "há uma passagem secreta",
    notes: "só se rolarem 15+",
    sharedWithPlayers: true,
  };

  it("o mestre vê tudo, sem corte", () => {
    expect(visibleTo([anotadoSemLiberar, liberado], true)).toEqual([
      anotadoSemLiberar,
      liberado,
    ]);
  });

  // ESTE É O TESTE QUE IMPORTA. Um handout anotado EXISTE na metadata da sala,
  // e o cliente do jogador recebe a metadata inteira. Só este filtro separa as
  // anotações do mestre dos olhos dele. Apagá-lo reintroduz o B4.
  it("o jogador não recebe o que foi anotado mas não liberado", () => {
    const doJogador = visibleTo([anotadoSemLiberar, liberado], false);
    expect(doJogador).toHaveLength(1);
    expect(doJogador[0].imageUrl).toBe(liberado.imageUrl);
  });

  it("o que o jogador recebe vem sem descrição e sem notas", () => {
    const [único] = visibleTo([anotadoSemLiberar, liberado], false);
    expect(único.description).toBe("");
    expect(único.notes).toBe("");
    expect(único.title).toBe("Mapa");
  });

  it("nenhum texto do mestre sobrevive na saída do jogador", () => {
    const serializado = JSON.stringify(
      visibleTo([anotadoSemLiberar, liberado], false),
    );
    expect(serializado).not.toContain("irmão do rei");
    expect(serializado).not.toContain("passagem secreta");
    expect(serializado).not.toContain("sessão 8");
    expect(serializado).not.toContain("15+");
  });

  it.each([true, false])("lista vazia continua vazia (mestre: %s)", (isGM) => {
    expect(visibleTo([], isGM)).toEqual([]);
  });
});

describe("parseHandout — tolerância a dados antigos e a JSON importado", () => {
  it("recusa registro sem imagem", () => {
    expect(parseHandout({ title: "sem imagem" })).toBeNull();
    expect(parseHandout({ imageUrl: "" })).toBeNull();
    expect(parseHandout(null)).toBeNull();
  });

  it("completa campos ausentes do formato antigo", () => {
    const h = parseHandout({ id: "uuid-velho", imageUrl: IMG, title: "X" });
    expect(h).toEqual({
      imageUrl: IMG,
      title: "X",
      description: "",
      notes: "",
      sharedWithPlayers: false,
    });
  });
});

describe("parseHandout barra URL de esquema perigoso", () => {
  it("recusa javascript: e data: vindos da metadata ou de backup", () => {
    expect(parseHandout({ imageUrl: "javascript:alert(1)", title: "X" })).toBeNull();
    expect(parseHandout({ imageUrl: "data:text/html,<script>", title: "X" })).toBeNull();
  });

  it("aceita http e https", () => {
    expect(parseHandout({ imageUrl: "https://ok.com/a.png", title: "X" })).not.toBeNull();
  });
});

describe("isSharePayload / isRevokePayload — fronteira do broadcast", () => {
  it("aceita um payload legítimo", () => {
    expect(isSharePayload({ imageUrl: "https://ok.com/a.png", title: "X" })).toBe(true);
    expect(isRevokePayload({ imageUrl: "https://ok.com/a.png" })).toBe(true);
  });

  it("recusa payload com esquema perigoso — um participante pode forjar", () => {
    expect(isSharePayload({ imageUrl: "javascript:alert(1)", title: "X" })).toBe(false);
    expect(isRevokePayload({ imageUrl: "data:text/html,x" })).toBe(false);
  });

  it("recusa payload malformado", () => {
    expect(isSharePayload(null)).toBe(false);
    expect(isSharePayload("texto")).toBe(false);
    expect(isSharePayload({ imageUrl: "https://ok.com/a.png" })).toBe(false); // sem título
    expect(isRevokePayload({})).toBe(false);
  });
});

describe("a poda é o que mantém a biblioteca ilimitada", () => {
  it("uma lista só de handouts descartáveis some inteira", () => {
    const descartaveis = [
      untrackedHandout("https://a.com/1.png", "um"),
      untrackedHandout("https://a.com/2.png", "dois"),
    ];
    expect(descartaveis.filter(isWorthStoring)).toEqual([]);
  });

  it("preserva o que está liberado ou anotado, e só isso", () => {
    const lista = [
      untrackedHandout("https://a.com/1.png", "descartável"),
      { ...untrackedHandout("https://a.com/2.png", "liberado"), sharedWithPlayers: true },
      { ...untrackedHandout("https://a.com/3.png", "anotado"), notes: "algo" },
    ];
    expect(lista.filter(isWorthStoring).map((h) => h.title)).toEqual([
      "liberado",
      "anotado",
    ]);
  });
});
