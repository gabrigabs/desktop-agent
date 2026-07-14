import type {
  FollowUpContextPolicy,
  FollowUpMemoryScope,
  FollowUpMode,
  FollowUpObservationSource,
  FollowUpSession,
} from "@desktop-agent/shared";
import { useCallback, useEffect } from "react";
import { getAgent } from "../../../lib/rpc";
import { useAgentStore } from "../../../stores/agent";

export function useFollowUp() {
  const sessions = useAgentStore((s) => s.followUpSessions);
  const activeSession = useAgentStore((s) => s.activeFollowUpSession);
  const setSessions = useAgentStore((s) => s.setFollowUpSessions);
  const setActiveSession = useAgentStore((s) => s.setActiveFollowUpSession);

  const refresh = useCallback(async () => {
    const api = await getAgent();
    const list = await api.listFollowUpSessions();
    setSessions(list);
    const active =
      list.find((session) =>
        session.status === "active" || session.status === "waiting_approval" || session.status === "paused",
      ) ?? null;
    setActiveSession(active);
  }, [setSessions, setActiveSession]);

  useEffect(() => {
    void refresh().catch((error) => console.error("Failed to load follow-up sessions:", error));
  }, [refresh]);

  const startSession = useCallback(
    async (
      mode: FollowUpMode,
      objective: string,
      options?: {
        spaceId?: string | null;
        memoryScope?: FollowUpMemoryScope;
        contextPolicy?: FollowUpContextPolicy;
      },
    ): Promise<FollowUpSession | null> => {
      const api = await getAgent();
      const session = await api.startFollowUpSession({
        mode,
        objective,
        spaceId: options?.spaceId ?? null,
        memoryScope: options?.memoryScope,
        contextPolicy: options?.contextPolicy,
      });
      await refresh();
      return session;
    },
    [refresh],
  );

  const pauseSession = useCallback(
    async (id: string) => {
      const api = await getAgent();
      await api.pauseFollowUpSession({ id });
      await refresh();
    },
    [refresh],
  );

  const resumeSession = useCallback(
    async (id: string) => {
      const api = await getAgent();
      await api.resumeFollowUpSession({ id });
      await refresh();
    },
    [refresh],
  );

  const stopSession = useCallback(
    async (id: string, reason: string) => {
      const api = await getAgent();
      await api.stopFollowUpSession({ id, reason });
      await refresh();
    },
    [refresh],
  );

  const completeSession = useCallback(
    async (id: string, summary: string) => {
      const api = await getAgent();
      await api.completeFollowUpSession({ id, summary });
      await refresh();
    },
    [refresh],
  );

  const addObservation = useCallback(
    async (sessionId: string, content: string, source: FollowUpObservationSource) => {
      const api = await getAgent();
      await api.addFollowUpObservation({ sessionId, content, source });
      await refresh();
    },
    [refresh],
  );

  const addHypothesis = useCallback(
    async (sessionId: string, text: string) => {
      const api = await getAgent();
      await api.addFollowUpHypothesis({ sessionId, text });
      await refresh();
    },
    [refresh],
  );

  return {
    sessions,
    activeSession,
    refresh,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    completeSession,
    addObservation,
    addHypothesis,
  };
}
