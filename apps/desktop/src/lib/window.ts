import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

export const WINDOW_SIZES = {
  collapsed: { width: 120, height: 120 },
  expanded: { width: 380, height: 560 },
};

/**
 * Altera o tamanho e o estado da janela entre os modos "Pet Flutuante" (collapsed) e "Painel Expandido" (expanded).
 */
export async function setWindowMode(mode: "collapsed" | "expanded") {
  try {
    const appWindow = getCurrentWindow();
    const size = WINDOW_SIZES[mode];

    // Garante que a janela está temporariamente redimensionável para aplicar o novo tamanho
    await appWindow.setResizable(true);
    await appWindow.setSize(new LogicalSize(size.width, size.height));

    // Aguarda um curto intervalo para que a animação/redimensionamento do SO termine antes de travar a janela
    await new Promise((r) => setTimeout(r, 150));

    // Desabilita redimensionamento manual pelo usuário para manter o design pixel-perfect
    await appWindow.setResizable(false);

    // Configura o comportamento de foco
    if (mode === "expanded") {
      await appWindow.setFocus();
    }
  } catch (err) {
    console.error("Erro ao alterar o tamanho da janela:", err);
  }
}

/**
 * Alterna se a janela deve sempre ficar no topo de outras aplicações.
 */
export async function setAlwaysOnTop(alwaysOnTop: boolean) {
  try {
    const appWindow = getCurrentWindow();
    await appWindow.setAlwaysOnTop(alwaysOnTop);
  } catch (err) {
    console.error("Erro ao configurar sempre no topo:", err);
  }
}

/**
 * Oculta a janela atual.
 */
export async function hideWindow() {
  try {
    const appWindow = getCurrentWindow();
    await appWindow.hide();
  } catch (err) {
    console.error("Erro ao ocultar janela:", err);
  }
}

/**
 * Inicia o arrasto da janela programaticamente (útil para desviar de bloqueios de clique).
 */
export async function startWindowDrag() {
  try {
    const appWindow = getCurrentWindow();
    await appWindow.startDragging();
  } catch (err) {
    console.error("Erro ao iniciar arrasto:", err);
  }
}
