// @vitest-environment jsdom
/**
 * A ENTRADA do card do handout.
 *
 * Duas tentativas foram necessárias, e a primeira falhou por olhar para o sinal
 * errado: revelar quando a imagem carrega deixava o card aparecer dentro de um
 * iframe ainda no tamanho inicial, que encolhia em volta um instante depois.
 * Relatado como "alarga e volta".
 *
 * São DOIS sinais: a imagem resolveu E o popover já foi ajustado.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { HandoutModal, type HandoutModalProps } from "./HandoutModal";
import styles from "./HandoutModal.module.css";

afterEach(cleanup);

const IMG = "https://images.owlbear.rodeo/token.png";

function montar(over: Partial<HandoutModalProps> = {}) {
  const props: HandoutModalProps = {
    title: "Token 1",
    imageUrl: IMG,
    description: "",
    notes: "",
    sharedWithPlayers: false,
    canEdit: false,
    onClose: vi.fn(),
    ...over,
  };
  const { container } = render(<HandoutModal {...props} />);
  return container.firstElementChild as HTMLElement;
}

/** A imagem avisa que carregou, como o navegador faria. */
function imagemCarrega() {
  const img = document.querySelector("img");
  if (!img) throw new Error("nenhuma imagem renderizada");
  act(() => {
    img.dispatchEvent(new Event("load"));
  });
}

describe("o card só aparece quando a janela já está no tamanho final", () => {
  it("fica escondido enquanto a imagem não resolve", () => {
    const card = montar({ popoverSized: true });
    expect(card).not.toHaveClass(styles.ready);
  });

  it("fica escondido se a imagem resolveu mas o popover ainda não foi ajustado", () => {
    const card = montar({ popoverSized: false });
    imagemCarrega();
    expect(card).not.toHaveClass(styles.ready);
  });

  it("aparece quando os dois sinais chegam", () => {
    const card = montar({ popoverSized: true });
    imagemCarrega();
    expect(card).toHaveClass(styles.ready);
  });

  /** Uma imagem quebrada mostra a mensagem — e a mensagem precisa ser vista. */
  it("aparece também quando a imagem falha", () => {
    const card = montar({ popoverSized: true });
    act(() => {
      document.querySelector("img")!.dispatchEvent(new Event("error"));
    });
    expect(card).toHaveClass(styles.ready);
    expect(screen.getByText(/não foi possível carregar esta imagem/i)).toBeInTheDocument();
  });

  it("aparece quando não há imagem nenhuma para esperar", () => {
    const card = montar({ imageUrl: "", popoverSized: true });
    expect(card).toHaveClass(styles.ready);
  });

  /**
   * Quem renderiza o modal sem controlar o popover não pode ficar com um card
   * invisível para sempre.
   */
  it("sem a prop, não espera por popover nenhum", () => {
    const card = montar();
    imagemCarrega();
    expect(card).toHaveClass(styles.ready);
  });
});

describe("a seção do mestre é exclusiva dele", () => {
  it("não é renderizada para o jogador", () => {
    montar({ canEdit: false, description: "segredo", notes: "mais segredo" });
    expect(screen.queryByText(/só o mestre vê/i)).not.toBeInTheDocument();
    expect(screen.queryByText("segredo")).not.toBeInTheDocument();
  });

  it("o mestre vê descrição e notas", () => {
    montar({ canEdit: true, description: "a carta é falsa", notes: "revelar depois" });
    expect(screen.getByText(/só o mestre vê/i)).toBeInTheDocument();
    expect(screen.getByText("a carta é falsa")).toBeInTheDocument();
    expect(screen.getByText("revelar depois")).toBeInTheDocument();
  });

  it("o jogador não recebe os botões de liberar e editar", () => {
    montar({ canEdit: false, onToggleShare: vi.fn(), onSave: vi.fn() });
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /liberar|retirar|show/i })).not.toBeInTheDocument();
  });
});

/**
 * FIXAR.
 *
 * Nasceu de um relato: "só consigo salvar a imagem se tiver alguma anotação,
 * senão ele só some". Era o comportamento projetado — a poda que torna a
 * biblioteca ilimitada —, mas sem nenhuma forma de recusá-la.
 *
 * O botão mora AQUI e não na lista por um motivo estrutural: um handout ainda
 * não fixado, anotado nem liberado não aparece na lista. Esta janela é o único
 * lugar onde ele existe antes de ser salvo.
 */
describe("fixar no caderninho", () => {
  it("o jogador não tem o botão", () => {
    montar({ canEdit: false, onTogglePin: vi.fn() });
    expect(screen.queryByRole("button", { name: /fixar/i })).not.toBeInTheDocument();
  });

  it("o mestre vê 'Fixar' quando ainda não está fixado", () => {
    montar({ canEdit: true, onTogglePin: vi.fn(), pinned: false });
    const botao = screen.getByRole("button", { name: /^fixar no caderninho$/i });
    expect(botao).toHaveAttribute("aria-pressed", "false");
  });

  it("o mestre vê 'Desafixar' quando já está fixado", () => {
    montar({ canEdit: true, onTogglePin: vi.fn(), pinned: true });
    const botao = screen.getByRole("button", { name: /desafixar/i });
    expect(botao).toHaveAttribute("aria-pressed", "true");
  });

  it("clicar avisa quem controla o estado", async () => {
    const onTogglePin = vi.fn();
    montar({ canEdit: true, onTogglePin, pinned: false });
    await userEvent.click(screen.getByRole("button", { name: /^fixar no caderninho$/i }));
    expect(onTogglePin).toHaveBeenCalledTimes(1);
  });

  /**
   * O CASO QUE O USUÁRIO APONTOU: um handout com anotação já fica no
   * caderninho, mas o botão dizia "sem isto, some quando não houver anotação".
   * Um aviso falso sobre um handout que não ia sumir.
   */
  it("não avisa que vai sumir um handout que já fica por causa das notas", () => {
    montar({ canEdit: true, onTogglePin: vi.fn(), pinned: false, keptAnyway: true });
    const botao = screen.getByRole("button", { name: /^fixar no caderninho$/i });
    expect(botao).toHaveAttribute("title", expect.stringMatching(/já fica no caderninho/i));
    expect(botao).toHaveAttribute("title", expect.not.stringMatching(/some quando/i));
  });

  it("avisa que some quando ele de fato não fica por mais nada", () => {
    montar({ canEdit: true, onTogglePin: vi.fn(), pinned: false, keptAnyway: false });
    expect(screen.getByRole("button", { name: /^fixar no caderninho$/i })).toHaveAttribute(
      "title",
      expect.stringMatching(/some quando você fechar/i),
    );
  });

  it("desafixar avisa que ele continua ficando, quando for o caso", () => {
    montar({ canEdit: true, onTogglePin: vi.fn(), pinned: true, keptAnyway: true });
    expect(screen.getByRole("button", { name: /desafixar/i })).toHaveAttribute(
      "title",
      expect.stringMatching(/mesmo desafixando/i),
    );
  });

  /** O estado precisa ser legível sem depender de distinguir dois ícones. */
  it("o estado não depende só da cor nem do ícone", () => {
    montar({ canEdit: true, onTogglePin: vi.fn(), pinned: true });
    const botao = screen.getByRole("button", { name: /desafixar/i });
    expect(botao).toHaveAttribute("aria-pressed", "true");
    expect(botao).toHaveAttribute("title", expect.stringMatching(/fixado/i));
  });
});
