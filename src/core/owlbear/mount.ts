/**
 * Bootstrap comum das páginas da extensão.
 *
 * `OBR.onReady` só dispara quando a página está embutida num iframe do Owlbear.
 * Aberta direto no navegador (o que acontece o tempo todo em desenvolvimento,
 * quando você clica no endereço do Vite), o callback nunca roda e você fica
 * olhando para uma página em branco sem nenhuma pista do motivo.
 *
 * `OBR.isAvailable` distingue os dois casos.
 * https://docs.owlbear.rodeo/extensions/apis/#obr
 */
import OBR from "@owlbear-rodeo/sdk";

export function whenOwlbearReady(start: () => void): void {
  if (!OBR.isAvailable) {
    renderStandaloneNotice();
    return;
  }
  // >>> OBR: nada pode tocar o SDK antes do onReady.
  OBR.onReady(start);
}

/** Explica, na própria página, por que ela está vazia. */
function renderStandaloneNotice(): void {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      max-width: 30rem; margin: 3rem auto; padding: 1.25rem;
      background: #fff; color: #1c1c1c; border-radius: 4px;
      box-shadow: 0 4px 16px rgba(0,0,0,.15); line-height: 1.55;
    ">
      <h1 style="font-size: 1rem; margin: 0 0 .5rem;">
        Esta página precisa rodar dentro do Owlbear Rodeo
      </h1>
      <p style="margin: 0 0 .75rem; font-size: .875rem;">
        Ela é uma extensão: sozinha no navegador não tem com quem conversar.
      </p>
      <ol style="margin: 0; padding-left: 1.1rem; font-size: .875rem;">
        <li>Abra <a href="https://owlbear.app/profile">owlbear.app/profile</a></li>
        <li><strong>Add Extension</strong> → cole o endereço do
            <code>manifest.json</code> deste servidor</li>
        <li>Crie uma sala e <strong>habilite a extensão</strong> no diálogo</li>
      </ol>
    </div>
  `;
}
