import type { AgentProfile, PromptTemplate, SaveProfileInput } from "@desktop-agent/shared";
import { useCallback, useEffect, useState } from "react";
import { getAgent, isMissingRpcMethodError } from "../../../lib/rpc";

export function usePrompts() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const api = await getAgent();
      const [promptList, profileList, active] = await Promise.all([
        api.listPromptTemplates(),
        api.listAgentProfiles(),
        api.getActiveProfile(),
      ]);
      setPrompts(promptList);
      setProfiles(profileList);
      setActiveProfileId(active?.id ?? null);
    } catch (err) {
      if (!isMissingRpcMethodError(err)) {
        console.error("Failed to load prompts/profiles:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSavePrompt = useCallback(
    async (input: {
      id?: string;
      title: string;
      prompt: string;
      category?: string;
      icon?: string;
      executionMode?: "simple" | "workflow";
    }) => {
      try {
        const api = await getAgent();
        await api.savePromptTemplate(input);
        await refresh();
      } catch (err) {
        console.error("Failed to save prompt:", err);
      }
    },
    [refresh],
  );

  const handleDeletePrompt = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        await api.deletePromptTemplate({ id });
        await refresh();
      } catch (err) {
        console.error("Failed to delete prompt:", err);
      }
    },
    [refresh],
  );

  const handleSaveProfile = useCallback(
    async (input: SaveProfileInput) => {
      try {
        const api = await getAgent();
        await api.saveAgentProfile(input);
        await refresh();
      } catch (err) {
        console.error("Failed to save profile:", err);
      }
    },
    [refresh],
  );

  const handleDeleteProfile = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        await api.deleteAgentProfile({ id });
        if (activeProfileId === id) {
          await api.setActiveProfile({ profileId: null });
          setActiveProfileId(null);
        }
        await refresh();
      } catch (err) {
        console.error("Failed to delete profile:", err);
      }
    },
    [refresh, activeProfileId],
  );

  const handleSetActiveProfile = useCallback(async (profileId: string | null) => {
    try {
      const api = await getAgent();
      await api.setActiveProfile({ profileId });
      setActiveProfileId(profileId);
    } catch (err) {
      console.error("Failed to set active profile:", err);
    }
  }, []);

  return {
    prompts,
    profiles,
    activeProfileId,
    loading,
    refresh,
    handleSavePrompt,
    handleDeletePrompt,
    handleSaveProfile,
    handleDeleteProfile,
    handleSetActiveProfile,
  };
}
