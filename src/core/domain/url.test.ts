import { describe, expect, it } from "vitest";
import { isSafeImageUrl, sanitizeImageUrl } from "./url";

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
