import type { ConnectorConfig, McpTestResult } from "@desktop-agent/shared";
import { Database, Plug } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SaveConnectorInput } from "../hooks/useCapabilities";
import { ParserModePanel } from "../parser-mode/ParserModePanel";
import type { ParserModeState } from "../parser-mode/useParserMode";
import type { HelixMode } from "../types";
import { ConnectorsPanel } from "./ConnectorsPanel";

type Props = {
  variant: "normal" | "expanded";
  parser: ParserModeState;
  connectors: ConnectorConfig[];
  testingConnectorId: string | null;
  connectorTestResults?: Record<string, McpTestResult>;
  editingConnectorId?: string | null;
  showAddConnector?: boolean;
  onTestConnector: (id: string) => void;
  onToggleConnector: (id: string) => void;
  onSaveConnector?: (input: SaveConnectorInput) => void;
  onDeleteConnector?: (id: string) => void;
  onStartEditing?: (id: string) => void;
  onCancelEditing?: () => void;
  onShowAddConnector?: (value: boolean) => void;
  onRefreshCapabilities?: () => void;
  setQuery: (query: string) => void;
  setMode: (mode: HelixMode | "settings") => void;
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
};

export function SourcesPanel(props: Props) {
  const { t } = useTranslation("helix");
  const [section, setSection] = useState<"documents" | "connectors">("documents");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 items-center gap-1 border-b border-line pb-2">
        <button
          type="button"
          onClick={() => setSection("documents")}
          className={`flex h-8 items-center gap-2 rounded-lg px-3 text-xs transition-colors ${section === "documents" ? "bg-signal/10 text-signal" : "text-mute hover:bg-white/[0.04] hover:text-fg"}`}
        >
          <Database className="h-3.5 w-3.5" />
          {t("helix:navigation.parser")}
        </button>
        <button
          type="button"
          onClick={() => setSection("connectors")}
          className={`flex h-8 items-center gap-2 rounded-lg px-3 text-xs transition-colors ${section === "connectors" ? "bg-signal/10 text-signal" : "text-mute hover:bg-white/[0.04] hover:text-fg"}`}
        >
          <Plug className="h-3.5 w-3.5" />
          {t("helix:navigation.connectors")}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {section === "documents" ? (
          <ParserModePanel
            variant={props.variant === "expanded" ? "expanded" : "compact"}
            parser={props.parser}
            onBack={() => props.setMode("command")}
            setQuery={props.setQuery}
            setMode={props.setMode}
            onToastSuccess={props.onToastSuccess}
            onToastError={props.onToastError}
          />
        ) : (
          <ConnectorsPanel
            connectors={props.connectors.slice(0, 7)}
            testingConnectorId={props.testingConnectorId}
            connectorTestResults={props.connectorTestResults}
            editingConnectorId={props.editingConnectorId}
            showAddConnector={props.showAddConnector}
            onTest={props.onTestConnector}
            onToggle={props.onToggleConnector}
            onRefresh={props.onRefreshCapabilities}
            onSaveConnector={props.onSaveConnector}
            onDeleteConnector={props.onDeleteConnector}
            onStartEditing={props.onStartEditing}
            onCancelEditing={props.onCancelEditing}
            onShowAddConnector={props.onShowAddConnector}
            variant={props.variant === "expanded" ? "grid" : undefined}
          />
        )}
      </div>
    </div>
  );
}
