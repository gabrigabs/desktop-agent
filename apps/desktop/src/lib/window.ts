import { currentMonitor, getCurrentWindow, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";

export const WINDOW_SIZES = {
  collapsed: { width: 104, height: 104 },
  expanded: { width: 480, height: 760 },
  workspace: { width: 1180, height: 820 },
};

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function getWorkspaceBounds() {
  const monitor = await currentMonitor();
  if (!monitor) {
    return { x: 40, y: 40, width: WINDOW_SIZES.workspace.width, height: WINDOW_SIZES.workspace.height };
  }

  const margin = 24;
  const position = monitor.workArea.position.toLogical(monitor.scaleFactor);
  const size = monitor.workArea.size.toLogical(monitor.scaleFactor);

  return {
    x: Math.round(position.x + margin),
    y: Math.round(position.y + margin),
    width: Math.max(780, Math.round(size.width - margin * 2)),
    height: Math.max(620, Math.round(size.height - margin * 2)),
  };
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
    await appWindow.setMaxSize(null);

    if (mode === "workspace") {
      const bounds = await getWorkspaceBounds();
      await appWindow.setMinSize(new LogicalSize(760, 560));
      await appWindow.setFullscreen(false);
      await appWindow.setSimpleFullscreen(false);
      await appWindow.unmaximize();
      await appWindow.setSize(new LogicalSize(bounds.width, bounds.height));
      await appWindow.setPosition(new LogicalPosition(bounds.x, bounds.y));
      await appWindow.show();

      await new Promise((r) => setTimeout(r, 180));

      const actualSize = await appWindow.innerSize();
      const scaleFactor = await appWindow.scaleFactor();
      const logicalSize = actualSize.toLogical(scaleFactor);
      if (logicalSize.width < 760 || logicalSize.height < 560) {
        await appWindow.setSimpleFullscreen(true);
      }

      await appWindow.setResizable(true);
      await appWindow.setFocus();
      return;
    }

    await appWindow.setMinSize(null);
    await appWindow.setFullscreen(false);
    await appWindow.setSimpleFullscreen(false);
    await appWindow.unmaximize();
    await appWindow.setSize(new LogicalSize(size.width, size.height));
    await appWindow.show();

    // Aguarda um curto intervalo para que a animação/redimensionamento do SO termine antes de travar a janela.
    await new Promise((r) => setTimeout(r, 150));

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
