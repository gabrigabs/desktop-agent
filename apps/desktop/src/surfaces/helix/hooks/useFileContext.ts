import { useCallback } from "react";
import { getAgent } from "../../../lib/rpc";
import { enrichFileContextWithAppleVision } from "../../../lib/vision-file-context";
import { useAgentStore } from "../../../stores/agent";

export function useFileContext(onError?: (message: string) => void) {
  const fileContext = useAgentStore((s) => s.fileContext);
  const addFileContext = useAgentStore((s) => s.addFileContext);
  const removeFileContext = useAgentStore((s) => s.removeFileContext);
  const clearFileContext = useAgentStore((s) => s.clearFileContext);

  const attachFiles = useCallback(
    async (paths: string[]): Promise<{ errors: string[] }> => {
      if (paths.length === 0) return { errors: [] };
      try {
        const api = await getAgent();
        const result = await api.readFileContext({ paths });
        if (result.files.length > 0) {
          const files = await Promise.all(result.files.map((file) => enrichFileContextWithAppleVision(file)));
          addFileContext(files);
          const visionErrors = files
            .filter((file) => file.parsedMetadata?.visionError)
            .map((file) => `${file.displayName}: ${file.parsedMetadata?.visionError}`);
          if (visionErrors.length > 0) onError?.(visionErrors.join("\n"));
        }
        if (result.errors.length > 0) onError?.(result.errors.join("\n"));
        return { errors: result.errors };
      } catch (err) {
        const message = `Failed to read files: ${err instanceof Error ? err.message : String(err)}`;
        onError?.(message);
        return { errors: [message] };
      }
    },
    [addFileContext, onError],
  );

  const removeFile = useCallback(
    (path: string) => {
      removeFileContext(path);
    },
    [removeFileContext],
  );

  const clear = useCallback(() => {
    clearFileContext();
  }, [clearFileContext]);

  return {
    fileContext,
    attachFiles,
    removeFile,
    clear,
  };
}
