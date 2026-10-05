/**
 * Controle de tema — três estados, não dois.
 *
 * POR QUE TRÊS: a extensão vive dentro do Owlbear, que tem tema próprio. Quem
 * já escolheu escuro lá declarou a preferência uma vez; um botão de duas
 * posições obrigaria a declarar de novo, e a escolha ficaria errada no dia em
 * que a pessoa trocasse o tema do Owlbear. "Automático" é o padrão e acompanha.
 *
 * POR QUE SEGMENTADO, e não um botão que cicla: ciclar entre três estados
 * esconde o estado atual e obriga a adivinhar quantos cliques faltam. Aqui os
 * três ficam visíveis e o atual é anunciado por `aria-checked`.
 *
 * Não conhece o SDK nem o `localStorage` — recebe e devolve, como todo o resto
 * de `ui/`.
 */
import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemePreference } from "../core/domain/theme";
import styles from "./ThemeToggle.module.css";

const OPCOES: {
  valor: ThemePreference;
  rotulo: string;
  Icone: typeof Monitor;
}[] = [
  { valor: "auto", rotulo: "Acompanhar o Owlbear", Icone: Monitor },
  { valor: "light", rotulo: "Tema claro", Icone: Sun },
  { valor: "dark", rotulo: "Tema escuro", Icone: Moon },
];

export interface ThemeToggleProps {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}

export function ThemeToggle({ preference, onChange }: ThemeToggleProps) {
  return (
    /* `radiogroup`: são opções mutuamente exclusivas, não três botões soltos.
       É o que faz o leitor de tela anunciar "1 de 3" e o teclado navegar com
       as setas, como em qualquer grupo de rádio nativo. */
    <div className={styles.group} role="radiogroup" aria-label="Tema">
      {OPCOES.map(({ valor, rotulo, Icone }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={preference === valor}
          className={styles.option}
          onClick={() => onChange(valor)}
          title={rotulo}
          aria-label={rotulo}
        >
          <Icone size={14} aria-hidden />
        </button>
      ))}
    </div>
  );
}
