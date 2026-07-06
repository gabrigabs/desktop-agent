import { useCallback, useEffect, useState } from "react";
import { useAgentStore } from "../../../stores/agent";
import { callAgentWithRuntimeRefresh, isStaleRuntimeError } from "../constants";

export function useCapabilities() {
  const setConnectors = useAgentStore((s) => s.setConnectors);
  const setError = useAgentStore((s) => s.setError);
  const addAgentLog = useAgentStore((s) => s.addAgentLog);
  const [testingConnectorId, setTestingConnectorId] = useState<string | null>(null);

  const refreshCapabilities = useCallback(async () => {
    try {
      const capabilities = await callAgentWithRuntimeRefresh("listCapabilities", (api) =>
        api.listCapabilities(),
      );
      setConnectors(capabilities.connectors);
    } catch (err) {
      if (!isStaleRuntimeError(err)) {
        console.error("Failed to refresh capabilities:", err);
      }
    }
  }, [setConnectors]);

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
        await callAgentWithRuntimeRefresh("saveMcpServer", (api) =>
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
        );
        await refreshCapabilities();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar conector");
      }
    },
    [refreshCapabilities, setError],
  );

  const handleTestConnector = useCallback(
    async (connectorId: string) => {
      setTestingConnectorId(connectorId);
      try {
        const result = await callAgentWithRuntimeRefresh("testMcpServer", (api) =>
          api.testMcpServer({ id: connectorId }),
        );
        if (!result.ok) {
          addAgentLog({ type: "tool_fail", text: result.error || "Conector não passou no teste" });
        } else {
          addAgentLog({ type: "info", text: "Conector pronto" });
        }
        await refreshCapabilities();
      } catch (err) {
        addAgentLog({ type: "tool_fail", text: err instanceof Error ? err.message : String(err) });
      } finally {
        setTestingConnectorId(null);
      }
    },
    [refreshCapabilities, addAgentLog],
  );

  return { testingConnectorId, refreshCapabilities, handleToggleConnector, handleTestConnector };
}
