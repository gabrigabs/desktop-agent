import type { Skill } from "@desktop-agent/shared";
import { useCallback, useEffect, useState } from "react";
import { getAgent, isMissingRpcMethodError } from "../../../lib/rpc";

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const api = await getAgent();
      const list = await api.listSkills();
      setSkills(list);
    } catch (err) {
      if (!isMissingRpcMethodError(err)) {
        setError(err instanceof Error ? err.message : "Falha ao carregar skills");
        console.error("Failed to load skills:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = useCallback(
    async (input: {
      id?: string;
      name: string;
      description?: string;
      prompt: string;
      systemPrompt?: string;
      provider?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      toolAllowlist?: string[];
      mcpAllowlist?: string[];
      maxSteps?: number;
      metadata?: Record<string, string>;
      compatibility?: string;
      enabled?: boolean;
    }) => {
      try {
        const api = await getAgent();
        await api.saveSkill(input);
        await refresh();
      } catch (err) {
        console.error("Failed to save skill:", err);
        throw err;
      }
    },
    [refresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        await api.deleteSkill({ id });
        await refresh();
      } catch (err) {
        console.error("Failed to delete skill:", err);
        throw err;
      }
    },
    [refresh],
  );

  return {
    skills,
    loading,
    error,
    refresh,
    handleSave,
    handleDelete,
  };
}
