import { beforeEach, describe, expect, test } from "bun:test";
import { useAgentStore } from "../../apps/desktop/src/stores/agent";

describe("agent streaming store", () => {
  beforeEach(() => {
    useAgentStore.getState().reset();
  });

  test("keeps the entire assistant stream when thinking tags cross chunks", () => {
    const store = useAgentStore.getState();
    store.startUserTurn("Pergunta", "free");
    store.appendAssistantChunk("<thi");
    store.appendAssistantChunk("nking>análise</thinking>Resposta final.");
    store.finalizeAssistantTurn("complete");

    const assistant = useAgentStore.getState().messages.at(-1);
    expect(assistant?.blocks).toEqual([
      { type: "thinking", content: "análise", collapsed: true },
      { type: "text", content: "Resposta final." },
    ]);
    expect(useAgentStore.getState().result).toBe("Resposta final.");
  });

  test("flushes a partial tag as text when the response completes", () => {
    const store = useAgentStore.getState();
    store.startUserTurn("Pergunta", "free");
    store.appendAssistantChunk("Resposta <thi");
    store.finalizeAssistantTurn("complete");

    const assistant = useAgentStore.getState().messages.at(-1);
    expect(assistant?.blocks).toEqual([{ type: "text", content: "Resposta <thi" }]);
  });

  test("preserves the active composer action and capture editor when the window mode changes", () => {
    const store = useAgentStore.getState();
    store.setActiveComposerActionId("web-search");
    store.setScreenCapture({
      preview: {
        captureId: "capture-1",
        displayId: 1,
        width: 1440,
        height: 900,
        previewDataUrl: "data:image/png;base64,preview",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      },
      editorAction: "screen-region",
      crop: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    });

    store.setUiMode("expanded");

    const next = useAgentStore.getState();
    expect(next.activeComposerActionId).toBe("web-search");
    expect(next.screenCapture.editorAction).toBe("screen-region");
    expect(next.screenCapture.crop).toEqual({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
  });
});
