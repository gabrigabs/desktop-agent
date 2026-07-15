import type { WorkflowStepKind, WorkflowTemplate, WorkflowTemplateSettings } from "@desktop-agent/shared";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAgent, isMissingRpcMethodError } from "../../../lib/rpc";

export function useWorkflows() {
  const { t } = useTranslation("helix");
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const api = await getAgent();
      const list = await api.listWorkflowTemplates();
      setTemplates(list);
    } catch (err) {
      if (!isMissingRpcMethodError(err)) {
        setError(err instanceof Error ? err.message : t("helix:useWorkflows.loadError"));
        console.error("Failed to load workflow templates:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = useCallback(
    async (input: {
      id?: string;
      name: string;
      description?: string;
      prompt: string;
      settings?: WorkflowTemplateSettings;
      steps?: Array<{ name: string; kind: WorkflowStepKind; config: Record<string, unknown> }>;
      enabled?: boolean;
    }) => {
      try {
        const api = await getAgent();
        await api.saveWorkflowTemplate({
          id: input.id,
          name: input.name,
          description: input.description,
          prompt: input.prompt,
          settings: input.settings,
          steps: input.steps,
          enabled: input.enabled,
        });
        await refresh();
      } catch (err) {
        console.error("Failed to save workflow template:", err);
        throw err;
      }
    },
    [refresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        await api.deleteWorkflowTemplate({ id });
        await refresh();
      } catch (err) {
        console.error("Failed to delete workflow template:", err);
        throw err;
      }
    },
    [refresh],
  );

  return {
    templates,
    loading,
    error,
    refresh,
    handleSave,
    handleDelete,
  };
}
