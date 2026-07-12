import { useEffect, useState } from "react";

type DragDropState = {
  isDragging: boolean;
};

export function useDragDrop(onDrop: (paths: string[]) => void) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const webview = getCurrentWebview();
        unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type === "enter" || event.payload.type === "over") {
            setIsDragging(true);
          } else if (event.payload.type === "drop") {
            setIsDragging(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              onDrop(paths);
            }
          } else if (event.payload.type === "leave") {
            setIsDragging(false);
          }
        });
      } catch {
        // Tauri webview API not available (e.g. in dev/browser)
      }
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, [onDrop]);

  return { isDragging } satisfies DragDropState;
}
