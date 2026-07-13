import type { HelixArtifact } from "./helix";

export type WorkspaceLayout = "chat" | "dashboard";

export type MemoryFact = {
  id: string;
  content: string;
  origin: "manual" | "assistant";
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  sourceTurnId?: string;
};

export type Workspace = {
  id: string;
  name: string;
  icon: string;
  color: string;
  folderPath: string;
  purpose: string;
  instructions: string;
  profileId?: string;
  preferredLayout: WorkspaceLayout;
  memoryEnabled: boolean;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceDocument = {
  workspaceId: string;
  documentId: string;
  addedAt: string;
};

export type WorkspaceTemplate = {
  name: string;
  icon: string;
  color: string;
  purpose: string;
  systemPrompt: string;
  tools: string[];
  preferredLayout: WorkspaceLayout;
};

export function artifactToWorkspaceTemplate(artifact: HelixArtifact): WorkspaceTemplate {
  return {
    name: artifact.name,
    icon: artifact.icon,
    color: artifact.color,
    purpose: artifact.description,
    systemPrompt: artifact.systemPrompt,
    tools: artifact.tools,
    preferredLayout: artifact.ui.panel === "dashboard" ? "dashboard" : "chat",
  };
}
