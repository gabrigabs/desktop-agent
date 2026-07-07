import { currentMonitor, getCurrentWindow, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";

export type WindowMode = "collapsed" | "normal" | "expanded";

export const WINDOW_SIZES = {
  collapsed: { width: 104, height: 104 },
  normal: { width: 520, height: 820 },
  expanded: { width: 1180, height: 820 },
};

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function getExpandedWindowBounds() {
  const monitor = await currentMonitor();
  if (!monitor) {
    return { x: 40, y: 40, width: WINDOW_SIZES.expanded.width, height: WINDOW_SIZES.expanded.height };
  }

  const margin = 56;
  const position = monitor.workArea.position.toLogical(monitor.scaleFactor);
  const size = monitor.workArea.size.toLogical(monitor.scaleFactor);
  const width = Math.min(WINDOW_SIZES.expanded.width, Math.max(860, Math.round(size.width - margin * 2)));
  const height = Math.min(WINDOW_SIZES.expanded.height, Math.max(620, Math.round(size.height - margin * 2)));

  return {
    x: Math.round(position.x + Math.max(0, (size.width - width) / 2)),
    y: Math.round(position.y + Math.max(0, (size.height - height) / 2)),
    width,
    height,
  };
}

/**
 * Altera o tamanho e o estado da janela entre os modos de visualização do app.
 */
export async function setWindowMode(mode: WindowMode, options?: { alwaysOnTop?: boolean }) {
  if (!isTauriRuntime()) return;

  try {
    const appWindow = getCurrentWindow();
    const size = WINDOW_SIZES[mode];

    // Garante que a janela está temporariamente redimensionável para aplicar o novo tamanho.
    await appWindow.setResizable(true);
    await appWindow.setMaxSize(null);

    if (mode === "expanded") {
      const bounds = await getExpandedWindowBounds();
      await appWindow.setMinSize(new LogicalSize(760, 560));
      await appWindow.setFullscreen(false);
      await appWindow.setSimpleFullscreen(false);
      await appWindow.unmaximize();
      await appWindow.setSize(new LogicalSize(bounds.width, bounds.height));
      await appWindow.setPosition(new LogicalPosition(bounds.x, bounds.y));
      await appWindow.show();
      await appWindow.setShadow(false);

      await appWindow.setResizable(true);
      if (options?.alwaysOnTop !== undefined) {
        await appWindow.setAlwaysOnTop(options.alwaysOnTop);
      }
      await appWindow.setFocus();
      return;
    }

    await appWindow.setMinSize(null);
    await appWindow.setFullscreen(false);
    await appWindow.setSimpleFullscreen(false);
    await appWindow.unmaximize();
    await appWindow.setSize(new LogicalSize(size.width, size.height));
    await appWindow.show();
    await appWindow.setShadow(false);

    // Aguarda um curto intervalo para que a animação/redimensionamento do SO termine antes de travar a janela.
    await new Promise((r) => setTimeout(r, 150));

    await appWindow.setResizable(false);
    if (options?.alwaysOnTop !== undefined) {
      await appWindow.setAlwaysOnTop(options.alwaysOnTop);
    }

    // Configura o comportamento de foco
    if (mode !== "collapsed") {
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
 * Fecha a janela atual sem encerrar o processo do app (mantém tray/menu bar ativos).
 */
export async function closeApp() {
  if (!isTauriRuntime()) return;

  try {
    const appWindow = getCurrentWindow();
    await appWindow.hide();
  } catch (err) {
    console.error("Erro ao fechar janela:", err);
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
