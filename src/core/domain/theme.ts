/**
 * Resolução do tema — ver `documents/design.md`, §2.
 *
 * A extensão vive DENTRO do Owlbear, que tem tema próprio. Quem já escolheu
 * escuro lá declarou a preferência uma vez; perguntar de novo é a extensão
 * ignorando o que o usuário já disse. Por isso o padrão é acompanhar o
 * anfitrião, e a escolha explícita existe para o caso minoritário.
 *
 * Camada pura de propósito: nada aqui conhece o SDK nem o navegador, então a
 * regra é testável sem os dois.
 */

/** O que o usuário escolheu. `auto` = o que o Owlbear estiver usando. */
export type ThemePreference = "auto" | "light" | "dark";

/** O que a interface de fato pinta. */
export type ThemeMode = "light" | "dark";

const PREFERENCIAS: readonly string[] = ["auto", "light", "dark"];

/**
 * O modo efetivo.
 *
 * @param preference o que o usuário escolheu
 * @param hostMode o modo do Owlbear, ou `null` quando ainda não se sabe — o
 *   que acontece no primeiro quadro, antes do `getTheme()` responder, e em
 *   qualquer falha do SDK
 */
export function resolveTheme(
  preference: ThemePreference,
  hostMode: ThemeMode | null,
): ThemeMode {
  if (preference !== "auto") return preference;
  // Escuro no desconhecido: é o padrão do Owlbear, e abrir branco dentro de
  // uma interface escura é mais agressivo que o contrário.
  return hostMode ?? "dark";
}

/**
 * Normaliza o que veio do `localStorage`.
 *
 * O valor atravessa uma fronteira não confiável (NF4): o usuário pode editar,
 * uma versão anterior pode ter gravado outro formato, e o navegador devolve
 * `null` quando não há nada. Em qualquer dúvida, `auto` — que é o padrão e
 * nunca contraria o anfitrião.
 */
export function parsePreference(raw: unknown): ThemePreference {
  return typeof raw === "string" && PREFERENCIAS.includes(raw)
    ? (raw as ThemePreference)
    : "auto";
}
