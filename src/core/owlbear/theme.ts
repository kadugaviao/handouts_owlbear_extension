/**
 * Ponte entre o tema do Owlbear e o nosso — ver `documents/design.md`, §2.
 *
 * O Owlbear entrega `{ mode: "DARK" | "LIGHT", primary, secondary, background,
 * text }`. Pegamos SÓ O MODO. Copiar a paleta dele para dentro dos nossos
 * componentes faria a extensão virar um clone sem identidade — que é o oposto
 * do que a refatoração visual quer.
 *
 * Tudo aqui falha para `null` ou para um no-op. Tema é a informação mais
 * cosmética que o SDK oferece: o B22 derrubou a extensão inteira por causa de
 * uma leitura de posição de janela, e posição importa mais que cor.
 */
import { useCallback, useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import {
  parsePreference,
  resolveTheme,
  type ThemeMode,
  type ThemePreference,
} from "../domain/theme";

/** Onde a escolha do usuário fica. Preferência de APARELHO, não da sala. */
const STORAGE_KEY = "obr-handouts:theme";

/** Traduz o modo do SDK para o nosso, ou `null` se não reconhecer. */
function toMode(raw: unknown): ThemeMode | null {
  if (raw === "DARK") return "dark";
  if (raw === "LIGHT") return "light";
  return null;
}

/** O modo do Owlbear agora, ou `null` quando não dá para saber. */
export async function readOwlbearMode(): Promise<ThemeMode | null> {
  try {
    // >>> OBR: tema do anfitrião.
    const theme = await OBR.theme.getTheme();
    return toMode(theme?.mode);
  } catch {
    return null;
  }
}

/**
 * Avisa quando o usuário troca o tema dentro do Owlbear.
 *
 * @returns função de cancelamento — inofensiva mesmo se o registro falhar.
 */
export function onOwlbearThemeChange(
  onMode: (mode: ThemeMode) => void,
): () => void {
  try {
    // >>> OBR: assinatura da troca de tema.
    return OBR.theme.onChange((theme) => {
      const mode = toMode(theme?.mode);
      if (mode) onMode(mode);
    });
  } catch {
    return () => undefined;
  }
}

/** Lê a preferência gravada. Em iframe, o armazenamento pode ser bloqueado. */
function readStored(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "auto";
  }
}

/**
 * O tema desta janela: lê o anfitrião, aplica a escolha do usuário, e escreve
 * `data-theme` na raiz do documento — que é onde o `global.css` troca a camada
 * semântica.
 */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStored);
  const [hostMode, setHostMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    let ativo = true;
    void readOwlbearMode().then((mode) => {
      if (ativo) setHostMode(mode);
    });
    const parar = onOwlbearThemeChange((mode) => {
      if (ativo) setHostMode(mode);
    });
    return () => {
      ativo = false;
      parar();
    };
  }, []);

  /**
   * O painel e a janela do handout são DOCUMENTOS SEPARADOS, cada um no seu
   * iframe. Sem isto, trocar o tema no painel deixaria uma janela aberta no
   * tema antigo — meio claro, meio escuro, com cara de defeito.
   *
   * O evento `storage` só dispara nos OUTROS documentos da mesma origem, que é
   * exatamente o que queremos: quem fez a troca já se atualizou pelo estado.
   */
  useEffect(() => {
    function sincronizar(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      setPreferenceState(parsePreference(event.newValue));
    }
    window.addEventListener("storage", sincronizar);
    return () => window.removeEventListener("storage", sincronizar);
  }, []);

  const mode = resolveTheme(preference, hostMode);

  useEffect(() => {
    // O `:root` do global.css já é o escuro, então escrever "dark" é redundante
    // — mas escrever sempre mantém o atributo como única fonte da verdade, em
    // vez de "ausente significa escuro", que ninguém lembra depois.
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Armazenamento bloqueado: a escolha vale nesta sessão e não persiste.
      // Perder a preferência é bem melhor que derrubar a janela.
    }
  }, []);

  return { preference, mode, setPreference };
}
