import type { McpTestResult, PermissionLevel } from "@desktop-agent/shared";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgentStore } from "../../../stores/agent";
import { callAgentWithRuntimeRefresh, isStaleRuntimeError, useStaleRuntimeMessage } from "../constants";

export type SaveConnectorInput = {
  id?: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  preset?: boolean;
  permissionPolicy?: PermissionLevel[];
};

export function useCapabilities() {
  const { t } = useTranslation("helix");
  const staleMessage = useStaleRuntimeMessage();
  const setConnectors = useAgentStore((s) => s.setConnectors);
  const setError = useAgentStore((s) => s.setError);
  const addAgentLog = useAgentStore((s) => s.addAgentLog);
  const [testingConnectorId, setTestingConnectorId] = useState<string | null>(null);
  const [connectorTestResults, setConnectorTestResults] = useState<Record<string, McpTestResult>>({});
  const [editingConnectorId, setEditingConnectorId] = useState<string | null>(null);
  const [showAddConnector, setShowAddConnector] = useState(false);

  const refreshCapabilities = useCallback(async () => {
    try {
      const capabilities = await callAgentWithRuntimeRefresh(
        "listCapabilities",
        (api) => api.listCapabilities(),
        staleMessage,
      );
      setConnectors(capabilities.connectors);
    } catch (err) {
      if (!isStaleRuntimeError(err, staleMessage)) {
        console.error("Failed to refresh capabilities:", err);
      }
    }
  }, [setConnectors, staleMessage]);

  useEffect(() => {
    refreshCapabilities();
  }, [refreshCapabilities]);

  const handleToggleConnector = useCallback(
    async (connectorId: string) => {
      const store = useAgentStore.getState();
      const connector = store.connectors.find((item) => item.id === connectorId);
      const command = connector?.command;
      if (!connector || !command) return;

      try {
        await callAgentWithRuntimeRefresh(
          "saveMcpServer",
          (api) =>
            api.saveMcpServer({
              server: {
                id: connector.id,
                name: connector.name,
                command,
                args: connector.args,
                enabled: !connector.enabled,
                preset: connector.preset,
                permissionPolicy: connector.permissionPolicy,
              },
            }),
          staleMessage,
        );
        await refreshCapabilities();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("helix:errors.updateConnector"));
      }
    },
    [refreshCapabilities, setError, staleMessage, t],
  );

  const handleTestConnector = useCallback(
    async (connectorId: string) => {
      setTestingConnectorId(connectorId);
      try {
        const result = await callAgentWithRuntimeRefresh(
          "testMcpServer",
          (api) => api.testMcpServer({ id: connectorId }),
          staleMessage,
        );
        setConnectorTestResults((prev) => ({ ...prev, [connectorId]: result }));
        if (!result.ok) {
          addAgentLog({ type: "tool_fail", text: result.error || t("helix:errors.connectorFailed") });
        } else {
          const toolCount = result.tools?.length ?? 0;
          addAgentLog({ type: "info", text: t("helix:errors.connectorReady", { count: toolCount }) });
        }
        await refreshCapabilities();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setConnectorTestResults((prev) => ({ ...prev, [connectorId]: { ok: false, error: errorMsg } }));
        addAgentLog({ type: "tool_fail", text: errorMsg });
      } finally {
        setTestingConnectorId(null);
      }
    },
    [refreshCapabilities, addAgentLog, t, staleMessage],
  );

  const handleSaveConnector = useCallback(
    async (input: SaveConnectorInput) => {
      try {
        await callAgentWithRuntimeRefresh(
          "saveMcpServer",
          (api) => api.saveMcpServer({ server: input }),
          staleMessage,
        );
        await refreshCapabilities();
        setEditingConnectorId(null);
        setShowAddConnector(false);
        addAgentLog({
          type: "info",
          text: input.id ? t("helix:errors.connectorUpdated") : t("helix:errors.connectorAdded"),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("helix:errors.saveConnector"));
      }
    },
    [refreshCapabilities, setError, addAgentLog, staleMessage, t],
  );

  const handleDeleteConnector = useCallback(
    async (connectorId: string) => {
      try {
        await callAgentWithRuntimeRefresh(
          "deleteMcpServer",
          (api) => api.deleteMcpServer({ id: connectorId }),
          staleMessage,
        );
        setConnectorTestResults((prev) => {
          const next = { ...prev };
          delete next[connectorId];
          return next;
        });
        await refreshCapabilities();
        addAgentLog({ type: "info", text: t("helix:errors.connectorRemoved") });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("helix:errors.deleteConnector"));
      }
    },
    [refreshCapabilities, setError, addAgentLog, t, staleMessage],
  );

  const handleStartEditing = useCallback((connectorId: string) => {
    setEditingConnectorId(connectorId);
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingConnectorId(null);
    setShowAddConnector(false);
  }, []);

  return {
    testingConnectorId,
    connectorTestResults,
    editingConnectorId,
    showAddConnector,
    setShowAddConnector,
    refreshCapabilities,
    handleTestConnector,
    handleToggleConnector,
    handleSaveConnector,
    handleDeleteConnector,
    handleStartEditing,
    handleCancelEditing,
  };
}
