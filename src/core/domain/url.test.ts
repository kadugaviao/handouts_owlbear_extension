import { describe, expect, it } from "vitest";
import { isSafeImageUrl, resizedImageUrl, sanitizeImageUrl } from "./url";

describe("isSafeImageUrl", () => {
  it("aceita http e https", () => {
    expect(isSafeImageUrl("https://images.owlbear.rodeo/a.png")).toBe(true);
    expect(isSafeImageUrl("http://localhost:5173/a.png")).toBe(true);
  });

  it("recusa esquemas perigosos", () => {
    expect(isSafeImageUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeImageUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeImageUrl("blob:https://exemplo.com/abc")).toBe(false);
    expect(isSafeImageUrl("file:///etc/passwd")).toBe(false);
  });

  it("recusa lixo e valores não-string", () => {
    expect(isSafeImageUrl("")).toBe(false);
    expect(isSafeImageUrl("   ")).toBe(false);
    expect(isSafeImageUrl("/caminho/relativo.png")).toBe(false);
    expect(isSafeImageUrl(null)).toBe(false);
    expect(isSafeImageUrl(42)).toBe(false);
  });
});

describe("sanitizeImageUrl", () => {
  it("devolve a URL quando segura e vazio quando não", () => {
    expect(sanitizeImageUrl("https://ok.com/a.png")).toBe("https://ok.com/a.png");
    expect(sanitizeImageUrl("javascript:alert(1)")).toBe("");
  });
});

describe("resizedImageUrl", () => {
  const owlbear = "https://images.owlbear.rodeo/sala/items/abc.png";

  it("acrescenta width em imagens do CDN do Owlbear", () => {
    expect(resizedImageUrl(owlbear, 64)).toBe(`${owlbear}?width=64`);
  });

  it("arredonda larguras fracionadas — o CDN espera inteiro", () => {
    expect(resizedImageUrl(owlbear, 63.7)).toBe(`${owlbear}?width=64`);
  });

  it("substitui um width que já exista em vez de duplicar", () => {
    expect(resizedImageUrl(`${owlbear}?width=999`, 64)).toBe(
      `${owlbear}?width=64`,
    );
  });

  it("NÃO mexe em URLs de outros domínios", () => {
    // Acrescentar `?width=` numa URL alheia vai de inócuo a quebrar a imagem.
    const externa = "https://i.imgur.com/abc.png";
    expect(resizedImageUrl(externa, 64)).toBe(externa);
  });

  it("devolve intacto o que não for URL de imagem segura", () => {
    expect(resizedImageUrl("javascript:alert(1)", 64)).toBe("javascript:alert(1)");
    expect(resizedImageUrl("", 64)).toBe("");
  });
});
