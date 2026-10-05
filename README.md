# Handouts para Owlbear Rodeo

![CI](https://github.com/kadugaviao/handouts_owlbear_extension/actions/workflows/ci.yml/badge.svg)

Mostre imagens para a sua mesa sem sair do mapa. O mestre abre uma ilustração,
anota o que quiser em segredo, e libera para os jogadores com um clique — numa
janela flutuante, como o Journal do Roll20.

---

## Instalar

A extensão é instalada **no seu perfil**, não dentro de uma sala.

1. Abra [owlbear.app/profile](https://owlbear.app/profile)
2. Clique em **Add Extension** e cole este endereço:

   ```
   https://handouts-owlbear-extension.pages.dev/manifest.json
   ```

3. Crie uma sala **marcando Handouts** na lista de extensões do diálogo

> **O passo 3 é o que mais se esquece.** Instalada mas não habilitada na sala,
> ela simplesmente não aparece.

**Os jogadores não instalam nada.** A lista de extensões pertence à sala: quem
entra pelo convite recebe a extensão junto, no computador ou no celular. E o
endereço é permanente — funciona com o seu computador desligado.

Para usar numa sala que já existe, abra as configurações dela e marque Handouts
lá.

---

## Usando

Clique no ícone 📄 na barra do Owlbear para abrir o **caderninho**.

### Abrir uma imagem

**+ Biblioteca** abre o gerenciador de imagens do próprio Owlbear. Escolha um
arquivo — ou envie um novo — e ele aparece numa janela flutuante sobre o mapa.

A biblioteca é ilimitada e não consome nada da sua sala. Você pode abrir quantas
imagens quiser.

### A janela do handout

| Botão | O que faz |
|---|---|
| 📌 **Fixar** | Guarda no caderninho mesmo sem anotação (veja abaixo) |
| ✏️ **Edit** | Muda título, imagem, descrição e notas |
| 👁️ **Show to Players** | Libera para os jogadores — entra na lista deles **e** abre na tela |
| 🚫 **Retirar** | Desfaz as duas coisas: some da lista e fecha na tela deles |
| 🔍 **Lupa** | Amplia a imagem |
| ✕ **Fechar** | Fecha só na sua tela, sem afetar ninguém |

Um clique no mapa **não** fecha a janela — só o ✕ fecha. Assim você não perde o
handout que acabou de mostrar com um clique sem querer.

### Descrição e notas são só suas

A seção com a faixa dourada — **SÓ O MESTRE VÊ** — nunca chega ao jogador. Ele
enxerga apenas o título e a imagem, e só dos handouts que você liberou.

> **Até onde isso protege:** o ocultamento é da interface. O Owlbear não oferece
> armazenamento privado, então alguém com conhecimento técnico consegue ler o
> que está guardado na sala. É o mesmo modelo do Roll20 — bom para separar o que
> cada um vê na mesa, não para guardar segredo de quem quer burlar.

### O que fica salvo, e o que não fica

O caderninho guarda só o necessário, porque o Owlbear reserva um espaço pequeno
por sala. Um handout **fica salvo** quando ele está:

- **fixado** no 📌,
- **liberado** para os jogadores, ou
- **anotado** (descrição ou notas).

Fora desses casos ele some do caderninho ao ser fechado — a imagem continua na
sua biblioteca do Owlbear, intacta, e reabrir de lá traz as anotações de volta.

**Se você quer que uma imagem simplesmente fique na lista, clique no 📌.**

Quando o espaço começa a apertar, uma barra aparece no caderninho mostrando
quanto já foi usado.

### Tema claro e escuro

Os três botões no topo do caderninho:

| | |
|---|---|
| 🖥️ **Automático** | Acompanha o tema do Owlbear *(padrão)* |
| ☀️ **Claro** | Força o tema claro |
| 🌙 **Escuro** | Força o tema escuro |

A escolha vale para este aparelho e é lembrada entre sessões.

### Cópia de segurança

**Exportar** baixa o caderninho inteiro num arquivo JSON. **Importar** lê esse
arquivo de volta — útil para levar o material para outra campanha.

> Importar **substitui** o caderninho inteiro. A tela avisa quantos handouts
> entram e quantos se perdem antes de você confirmar.

Se o navegador bloquear o download, a extensão mostra o texto na tela para você
copiar.

---

## Dúvidas comuns

**A extensão não aparece na sala.** Ela foi instalada no perfil mas não
habilitada na sala. Abra as configurações da sala e marque Handouts.

**O jogador não vê o handout que eu liberei.** Confira se o botão da janela está
mostrando **Retirar** — se mostrar *Show to Players*, ele ainda não foi liberado.

**Abri uma imagem e ela sumiu da lista.** É o comportamento normal de um handout
sem 📌, sem anotação e não liberado. Clique no 📌 para mantê-lo.

**A imagem não carrega.** O endereço pode ter expirado ou o arquivo foi removido
da sua biblioteca do Owlbear. Use **Edit** para escolher a imagem de novo.

---

## Mais

| | |
|---|---|
| [`PROJETO.md`](PROJETO.md) | O que é o projeto e em que estado está |
| [`documents/desenvolvimento.md`](documents/desenvolvimento.md) | Rodar, estrutura e armadilhas |
| [`documents/spec.md`](documents/spec.md) | Decisões, histórico e bugs |
| [`documents/design.md`](documents/design.md) | Tokens, tema e refatoração visual |

## Licença

[MIT](LICENSE).
