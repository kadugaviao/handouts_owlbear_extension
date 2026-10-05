// @vitest-environment jsdom
/**
 * Testes de interface do `HandoutList`.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * ---------------------------
 * A interface não tinha cobertura nenhuma, e isso cobrou caro: os bugs B24 e
 * B25 precisaram ser achados por leitura, e um PR que subia um major da
 * biblioteca de ícones passou no CI verde — não porque funcionava, mas porque
 * nada olhava para cá.
 *
 * COMO ESTES TESTES FORAM ESCRITOS
 * --------------------------------
 * O componente já existia, então todo teste passa de primeira — e um teste que
 * nunca falhou não prova nada. Cada bloco abaixo foi verificado por MUTAÇÃO:
 * o comportamento alvo foi quebrado de propósito no `HandoutList.tsx` e o teste
 * precisou ficar vermelho antes de ser aceito. O que cada mutação foi está
 * escrito no comentário de cada `describe`.
 *
 * O ambiente é `jsdom` só neste arquivo: os testes de `domain/` são funções
 * puras e rodam mais rápido em `node`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { HandoutList, type HandoutListProps } from "./HandoutList";
import type { Handout } from "../core/domain/handout";

// `globals: false` no Vitest: a limpeza automática do Testing Library não
// acontece sozinha, então é explícita aqui.
afterEach(cleanup);

const IMG = "https://images.owlbear.rodeo/mapa.png";

function handout(over: Partial<Handout> = {}): Handout {
  return {
    imageUrl: IMG,
    title: "Mapa da masmorra",
    description: "",
    notes: "",
    sharedWithPlayers: false,
    ...over,
  };
}

/**
 * A miniatura tem `alt=""` DE PROPÓSITO: é decorativa, e o título ao lado já
 * diz o que ela é. Isso a tira da árvore de acessibilidade, então nenhum
 * `getByRole("img")` a encontra — consultar o DOM aqui é o certo, não um
 * contorno.
 */
function miniatura(): HTMLImageElement {
  const img = document.querySelector("img");
  if (!img) throw new Error("nenhuma miniatura renderizada");
  return img;
}

/** O texto inteiro da barra de confirmação aberta, com os números no lugar. */
function textoDaConfirmacao(): string {
  const p = [...document.querySelectorAll("p")].find((el) =>
    /substitui|caderninho\?/i.test(el.textContent ?? ""),
  );
  if (!p) throw new Error("nenhuma confirmação aberta");
  return (p.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Renderiza com o mínimo, e devolve os espiões para as asserções. */
function montar(over: Partial<HandoutListProps> = {}) {
  const onOpen = vi.fn();
  const onOpenLibrary = vi.fn();
  const onRemove = vi.fn();
  const props: HandoutListProps = {
    handouts: [handout()],
    isGM: true,
    onOpen,
    onOpenLibrary,
    onRemove,
    ...over,
  };
  render(<HandoutList {...props} />);
  return { onOpen, onOpenLibrary, onRemove, props };
}

/**
 * MUTAÇÃO: trocar `isGM &&` por `true &&` em qualquer um dos três controles.
 *
 * É a fronteira de papel na interface. O corte real de dados acontece em
 * `useHandouts`/`visibleTo` (B24), mas um jogador que enxergasse o botão de
 * excluir poderia tentar apagar o caderninho do mestre.
 */
describe("o jogador não vê os controles do mestre", () => {
  const comoJogador = { isGM: false, onExport: () => true, onImport: vi.fn() };

  it.each([
    ["Biblioteca", /biblioteca/i],
    ["Exportar", /exportar/i],
    ["Importar", /importar/i],
  ])("não mostra %s", (_nome, padrao) => {
    montar(comoJogador);
    expect(screen.queryByRole("button", { name: padrao })).not.toBeInTheDocument();
  });

  it("não mostra a lixeira de nenhum item", () => {
    montar({ ...comoJogador, handouts: [handout(), handout({ imageUrl: "https://images.owlbear.rodeo/b.png" })] });
    expect(screen.queryByRole("button", { name: /tirar/i })).not.toBeInTheDocument();
  });

  it("não mostra o ponto de liberado, que é informação de autoria", () => {
    montar({ ...comoJogador, handouts: [handout({ sharedWithPlayers: true })] });
    expect(screen.queryByTitle(/liberado para os jogadores/i)).not.toBeInTheDocument();
  });

  it("mas continua vendo e abrindo os handouts da lista", async () => {
    const { onOpen, props } = montar(comoJogador);
    await userEvent.click(screen.getByRole("button", { name: /mapa da masmorra/i }));
    expect(onOpen).toHaveBeenCalledWith(props.handouts[0]);
  });
});

/**
 * MUTAÇÃO: chamar `onRemove(handout)` direto no `onClick` da lixeira, sem
 * passar pela confirmação.
 *
 * Excluir é irreversível e leva junto as anotações. O clique na lixeira precisa
 * abrir a confirmação, nunca executar.
 */
describe("excluir exige confirmação", () => {
  it("o clique na lixeira ainda não remove nada", async () => {
    const { onRemove } = montar();
    await userEvent.click(screen.getByRole("button", { name: /tirar/i }));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("a confirmação avisa que as anotações se perdem", async () => {
    montar({ handouts: [handout({ notes: "o vilão é o irmão do rei" })] });
    await userEvent.click(screen.getByRole("button", { name: /tirar/i }));
    expect(screen.getByText(/anotações serão perdidas/i)).toBeInTheDocument();
  });

  it("a confirmação avisa que o handout some da tela dos jogadores", async () => {
    montar({ handouts: [handout({ sharedWithPlayers: true })] });
    await userEvent.click(screen.getByRole("button", { name: /tirar/i }));
    expect(screen.getByText(/some da tela dos jogadores/i)).toBeInTheDocument();
  });

  it("cancelar fecha sem remover", async () => {
    const { onRemove } = montar();
    await userEvent.click(screen.getByRole("button", { name: /tirar/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.queryByText(/do caderninho\?/i)).not.toBeInTheDocument();
  });

  it("confirmar remove o handout certo", async () => {
    const outro = handout({ imageUrl: "https://images.owlbear.rodeo/b.png", title: "Carta" });
    const { onRemove } = montar({ handouts: [handout(), outro] });
    await userEvent.click(screen.getByRole("button", { name: /tirar carta/i }));
    await userEvent.click(screen.getByRole("button", { name: /^tirar$/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(outro);
  });
});

/**
 * MUTAÇÃO: voltar a união discriminada para dois `useState` independentes.
 *
 * Era um bug real: escolher um arquivo e clicar na lixeira mostrava as duas
 * barras de confirmação empilhadas, e não dava para saber qual botão fazia o
 * quê.
 */
describe("só uma confirmação aparece por vez", () => {
  it("abrir a de excluir fecha a de importar", async () => {
    const onImport = vi.fn();
    const { container } = render(
      <HandoutList
        handouts={[handout()]}
        isGM
        onOpen={vi.fn()}
        onOpenLibrary={vi.fn()}
        onRemove={vi.fn()}
        onImport={onImport}
      />,
    );

    const input = container.querySelector('input[type="file"]')!;
    await userEvent.upload(
      input as HTMLInputElement,
      new File([JSON.stringify([handout({ sharedWithPlayers: true })])], "b.json", {
        type: "application/json",
      }),
    );
    expect(await screen.findByRole("button", { name: /substituir/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /tirar mapa/i }));

    // A pergunta de importar precisa ter sumido — não basta a de excluir existir.
    expect(screen.queryByRole("button", { name: /substituir/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^tirar$/i })).toBeInTheDocument();
  });
});

/**
 * MUTAÇÃO: trocar `resizedImageUrl(handout.imageUrl, THUMB_WIDTH)` por
 * `handout.imageUrl`.
 *
 * É a maior otimização do projeto: sem o `?width=`, uma miniatura de 32 px
 * baixa e decodifica a ilustração inteira. O ganho é invisível na tela, então
 * só um teste segura.
 */
describe("as miniaturas pedem ao CDN o tamanho que cabe", () => {
  it("acrescenta ?width= na URL do CDN do Owlbear", () => {
    montar();
    expect(miniatura()).toHaveAttribute(
      "src",
      "https://images.owlbear.rodeo/mapa.png?width=64",
    );
  });

  it("não mexe na URL de outro domínio, que não entende o parâmetro", () => {
    montar({ handouts: [handout({ imageUrl: "https://exemplo.com/foto.png" })] });
    expect(miniatura()).toHaveAttribute("src", "https://exemplo.com/foto.png");
  });
});

/**
 * MUTAÇÃO: trocar `budget.warning` por `true` na condição de renderização.
 *
 * A barra existe para avisar antes de o mestre perder trabalho. Mostrá-la
 * sempre polui o painel; nunca mostrá-la deixa o estouro chegar de surpresa.
 */
describe("a barra de orçamento só aparece quando aperta", () => {
  const folgado = { used: 100, budget: 10240, ratio: 0.01, exceeded: false, warning: false };
  const apertado = { used: 8000, budget: 10240, ratio: 0.78, exceeded: false, warning: true };

  it("fica escondida com espaço de sobra", () => {
    montar({ budget: folgado });
    expect(screen.queryByText(/espaço do journal/i)).not.toBeInTheDocument();
  });

  it("aparece com os números reais quando passa do limiar", () => {
    montar({ budget: apertado });
    expect(screen.getByText(/espaço do journal/i)).toBeInTheDocument();
    expect(screen.getByText("7.8 kB / 10.0 kB")).toBeInTheDocument();
  });

  it("não aparece para o jogador, que nunca escreve na metadata", () => {
    montar({ isGM: false, budget: apertado });
    expect(screen.queryByText(/espaço do journal/i)).not.toBeInTheDocument();
  });
});

/**
 * MUTAÇÃO: ignorar o retorno de `onExport()` e nunca preencher o `fallbackJson`.
 *
 * O download pode ser bloqueado pelo sandbox do iframe. Quando o componente
 * sabe disso, precisa oferecer a saída — senão o mestre fica sem backup e sem
 * aviso.
 */
describe("exportação bloqueada oferece o JSON para copiar", () => {
  it("não mostra nada enquanto o download funciona", async () => {
    montar({ onExport: () => true, exportText: () => "{}" });
    await userEvent.click(screen.getByRole("button", { name: /exportar/i }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("mostra o JSON quando o navegador recusa o download", async () => {
    const json = '{"format":"obr-handouts"}';
    montar({ onExport: () => false, exportText: () => json });
    await userEvent.click(screen.getByRole("button", { name: /exportar/i }));
    expect(screen.getByRole("textbox")).toHaveValue(json);
    expect(screen.getByRole("button", { name: /copiar/i })).toBeInTheDocument();
  });
});

/**
 * MUTAÇÃO: engolir o erro do `parseBackup` em vez de mostrá-lo.
 *
 * Um JSON inválido tem que dizer o que houve. Importar substitui o journal
 * inteiro: "não aconteceu nada" é a pior resposta possível aqui.
 */
describe("importar um arquivo ruim explica o motivo", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    const { container } = render(
      <HandoutList
        handouts={[handout()]}
        isGM
        onOpen={vi.fn()}
        onOpenLibrary={vi.fn()}
        onRemove={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    input = container.querySelector('input[type="file"]')!;
  });

  it("avisa quando o arquivo não é JSON", async () => {
    await userEvent.upload(input, new File(["isto não é json"], "x.json", { type: "application/json" }));
    expect(await screen.findByText(/não é um json válido/i)).toBeInTheDocument();
  });

  it("avisa quando o JSON não tem handouts aproveitáveis", async () => {
    await userEvent.upload(input, new File(["[]"], "x.json", { type: "application/json" }));
    expect(await screen.findByText(/lista de handouts|nenhum handout/i)).toBeInTheDocument();
  });

  it("não chama onImport em nenhum dos casos", async () => {
    await userEvent.upload(input, new File(["isto não é json"], "x.json", { type: "application/json" }));
    await screen.findByText(/não é um json válido/i);
    expect(screen.queryByRole("button", { name: /substituir/i })).not.toBeInTheDocument();
  });
});

/**
 * MUTAÇÃO: trocar `confirmacao.handouts.length` por `handouts.length` no texto.
 *
 * Importar SUBSTITUI o journal inteiro e não dá para desfazer. Os dois números
 * — quantos entram e quantos se perdem — precisam estar certos antes do clique.
 */
describe("a confirmação de importar diz o que se perde", () => {
  it("mostra quantos entram e quantos serão substituídos", async () => {
    const atuais = [handout(), handout({ imageUrl: "https://images.owlbear.rodeo/b.png" })];
    const chegando = [
      handout({ imageUrl: "https://images.owlbear.rodeo/c.png" }),
      handout({ imageUrl: "https://images.owlbear.rodeo/d.png" }),
      handout({ imageUrl: "https://images.owlbear.rodeo/e.png" }),
    ];
    const onImport = vi.fn().mockResolvedValue(true);
    const { container } = render(
      <HandoutList
        handouts={atuais}
        isGM
        onOpen={vi.fn()}
        onOpenLibrary={vi.fn()}
        onRemove={vi.fn()}
        onImport={onImport}
      />,
    );

    await userEvent.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      new File([JSON.stringify(chegando)], "b.json", { type: "application/json" }),
    );

    await screen.findByRole("button", { name: /substituir/i });
    const aviso = textoDaConfirmacao();
    expect(aviso).toMatch(/Importar 3 handouts\?/); // quantos entram
    expect(aviso).toMatch(/substitui os 2 atuais/); // quantos se perdem
    expect(aviso).toMatch(/Não há como desfazer/);

    await userEvent.click(screen.getByRole("button", { name: /substituir/i }));
    expect(onImport).toHaveBeenCalledWith(chegando);
  });
});

/**
 * MUTAÇÃO: remover o `onDismissError` do botão, ou renderizar o erro sempre.
 *
 * Era o B20/B17: falha de escrita que não aparece deixa o mestre achando que
 * salvou.
 */
describe("o erro de escrita aparece e pode ser dispensado", () => {
  it("fica invisível quando não há erro", () => {
    montar({ writeError: null });
    expect(screen.queryByRole("button", { name: /dispensar/i })).not.toBeInTheDocument();
  });

  it("mostra a mensagem que veio do hook", () => {
    montar({ writeError: "O journal ocupa 11.2 kB, acima do limite" });
    expect(screen.getByText(/acima do limite/i)).toBeInTheDocument();
  });

  it("dispensar avisa quem controla o estado", async () => {
    const onDismissError = vi.fn();
    montar({ writeError: "falhou", onDismissError });
    await userEvent.click(screen.getByRole("button", { name: /dispensar/i }));
    expect(onDismissError).toHaveBeenCalledTimes(1);
  });
});

/**
 * MUTAÇÃO: usar o mesmo texto para os dois papéis.
 *
 * A lista vazia significa coisas diferentes: para o mestre é "você ainda não
 * abriu nada"; para o jogador é "o mestre não liberou nada". Mandar o jogador
 * clicar em Biblioteca seria pedir o que ele não pode fazer.
 */
describe("a lista vazia fala com quem está lendo", () => {
  it("ensina o mestre a começar", () => {
    montar({ handouts: [] });
    expect(screen.getByText(/nada no caderninho ainda/i)).toBeInTheDocument();
  });

  it("explica ao jogador que não depende dele", () => {
    montar({ handouts: [], isGM: false });
    expect(screen.getByText(/mestre ainda não liberou/i)).toBeInTheDocument();
    expect(screen.queryByText(/nada no caderninho ainda/i)).not.toBeInTheDocument();
  });
});
