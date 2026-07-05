import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

export const WINDOW_SIZES = {
  collapsed: { width: 104, height: 104 },
  expanded: { width: 480, height: 760 },
  workspace: { width: 980, height: 800 },
};

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Altera o tamanho e o estado da janela entre os modos "Pet Flutuante" (collapsed) e "Painel Expandido" (expanded).
 */
export async function setWindowMode(mode: "collapsed" | "expanded" | "workspace") {
  if (!isTauriRuntime()) return;

  try {
    const appWindow = getCurrentWindow();
    const size = WINDOW_SIZES[mode];

    // Garante que a janela está temporariamente redimensionável para aplicar o novo tamanho.
    await appWindow.setResizable(true);
    if (mode !== "workspace") {
      await appWindow.unmaximize();
    }
    await appWindow.setSize(new LogicalSize(size.width, size.height));

    if (mode === "workspace") {
      await appWindow.maximize();
    }

    // Aguarda um curto intervalo para que a animação/redimensionamento do SO termine antes de travar a janela.
    await new Promise((r) => setTimeout(r, 150));

    // No workspace, manter a janela redimensionável evita crop quando o SO ajusta dimensões.
    await appWindow.setResizable(mode === "workspace");

    // Configura o comportamento de foco
    if (mode === "expanded" || mode === "workspace") {
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
  if (!isTauriRuntime()) return;

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
  if (!isTauriRuntime()) return;

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
  if (!isTauriRuntime()) return;

  try {
    const appWindow = getCurrentWindow();
    await appWindow.startDragging();
  } catch (err) {
    console.error("Erro ao iniciar arrasto:", err);
  }
}
