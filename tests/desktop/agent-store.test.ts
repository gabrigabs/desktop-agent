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
});
