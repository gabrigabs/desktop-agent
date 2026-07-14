import type {
  FollowUpContextPolicy,
  FollowUpMemoryScope,
  FollowUpMode,
  FollowUpObservationSource,
  FollowUpSession,
} from "@desktop-agent/shared";
import { useCallback, useEffect, useState } from "react";
import { getAgent } from "../../../lib/rpc";
import { useAgentStore } from "../../../stores/agent";

export function useFollowUp() {
  const [error, setError] = useState<string | null>(null);
  const sessions = useAgentStore((s) => s.followUpSessions);
  const activeSession = useAgentStore((s) => s.activeFollowUpSession);
  const setSessions = useAgentStore((s) => s.setFollowUpSessions);
  const setActiveSession = useAgentStore((s) => s.setActiveFollowUpSession);

  const refresh = useCallback(async () => {
    try {
      const api = await getAgent();
      const list = await api.listFollowUpSessions();
      setSessions(list);
      const active =
        list.find((session) =>
          session.status === "active" || session.status === "waiting_approval" || session.status === "paused",
        ) ?? null;
      setActiveSession(active);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load follow-up sessions");
      throw cause;
    }
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
      try {
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
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to start follow-up");
        return null;
      }
    },
    [refresh],
  );

  const pauseSession = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        await api.pauseFollowUpSession({ id });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to pause follow-up");
      }
    },
    [refresh],
  );

  const resumeSession = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        await api.resumeFollowUpSession({ id });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to resume follow-up");
      }
    },
    [refresh],
  );

  const stopSession = useCallback(
    async (id: string, reason: string) => {
      try {
        const api = await getAgent();
        await api.stopFollowUpSession({ id, reason });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to stop follow-up");
      }
    },
    [refresh],
  );

  const completeSession = useCallback(
    async (id: string, summary: string) => {
      try {
        const api = await getAgent();
        await api.completeFollowUpSession({ id, summary });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to complete follow-up");
      }
    },
    [refresh],
  );

  const addObservation = useCallback(
    async (sessionId: string, content: string, source: FollowUpObservationSource) => {
      try {
        const api = await getAgent();
        await api.addFollowUpObservation({ sessionId, content, source });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to add observation");
      }
    },
    [refresh],
  );

  const addHypothesis = useCallback(
    async (sessionId: string, text: string) => {
      try {
        const api = await getAgent();
        await api.addFollowUpHypothesis({ sessionId, text });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to add hypothesis");
      }
    },
    [refresh],
  );

  return {
    sessions,
    activeSession,
    error,
    clearError: () => setError(null),
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
