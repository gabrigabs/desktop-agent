import type { MemoryFact, ParsedDocument, Workspace } from "@desktop-agent/shared";
import { useCallback, useEffect, useState } from "react";
import { getAgent } from "../../../lib/rpc";
import { useAgentStore } from "../../../stores/agent";

export type CreateWorkspaceInput = {
  name: string;
  folderPath: string;
  icon?: string;
  color?: string;
  purpose?: string;
  instructions?: string;
  profileId?: string;
  preferredLayout?: "chat" | "dashboard";
};

export function useWorkspaces() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ParsedDocument[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<ParsedDocument[]>([]);
  const workspaces = useAgentStore((s) => s.workspaces);
  const activeWorkspaceId = useAgentStore((s) => s.activeWorkspaceId);
  const memoryFacts = useAgentStore((s) => s.memoryFacts);
  const setWorkspaces = useAgentStore((s) => s.setWorkspaces);
  const setActiveWorkspaceId = useAgentStore((s) => s.setActiveWorkspaceId);
  const setMemoryFacts = useAgentStore((s) => s.setMemoryFacts);
  const addWorkspace = useAgentStore((s) => s.addWorkspace);
  const updateWorkspaceInList = useAgentStore((s) => s.updateWorkspaceInList);
  const removeWorkspaceFromList = useAgentStore((s) => s.removeWorkspaceFromList);
  const addMemoryFactToStore = useAgentStore((s) => s.addMemoryFactToStore);
  const updateMemoryFactInStore = useAgentStore((s) => s.updateMemoryFactInStore);
  const removeMemoryFactFromStore = useAgentStore((s) => s.removeMemoryFactFromStore);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = await getAgent();
      const list = await api.listWorkspaces();
      setWorkspaces(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }, [setWorkspaces]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createWorkspace = useCallback(
    async (input: CreateWorkspaceInput): Promise<string | null> => {
      try {
        const api = await getAgent();
        const { id } = await api.createWorkspace(input);
        const ws = await api.getWorkspace({ id });
        if (ws) addWorkspace(ws);
        return id;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create workspace");
        return null;
      }
    },
    [addWorkspace],
  );

  const loadWorkspaceContext = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        const [facts, attached, allDocuments] = await Promise.all([
          api.listMemoryFacts({ workspaceId: id }),
          api.listWorkspaceDocuments({ workspaceId: id }),
          api.listParsedDocuments({ limit: 100 }),
        ]);
        setMemoryFacts(facts);
        setDocuments(attached);
        setAvailableDocuments(allDocuments);
      } catch (err) {
        setMemoryFacts([]);
        setDocuments([]);
        setError(err instanceof Error ? err.message : "Failed to load workspace context");
      }
    },
    [setMemoryFacts],
  );

  const selectWorkspace = useCallback(
    async (id: string | null) => {
      setActiveWorkspaceId(id);
      if (id) localStorage.setItem("helix.active-workspace-id", id);
      else localStorage.removeItem("helix.active-workspace-id");
      if (!id) {
        setMemoryFacts([]);
        setDocuments([]);
      }
    },
    [setActiveWorkspaceId, setMemoryFacts],
  );

  useEffect(() => {
    if (activeWorkspaceId) void loadWorkspaceContext(activeWorkspaceId);
  }, [activeWorkspaceId, loadWorkspaceContext]);

  useEffect(() => {
    if (activeWorkspaceId || workspaces.length === 0) return;
    const savedId = localStorage.getItem("helix.active-workspace-id");
    if (savedId && workspaces.some((workspace) => workspace.id === savedId)) {
      void selectWorkspace(savedId);
    }
  }, [activeWorkspaceId, selectWorkspace, workspaces]);

  const updateWorkspace = useCallback(
    async (
      id: string,
      updates: {
        name?: string;
        purpose?: string;
        instructions?: string;
        folderPath?: string;
        icon?: string;
        profileId?: string | null;
        preferredLayout?: "chat" | "dashboard";
        memoryEnabled?: boolean;
        color?: string;
      },
    ) => {
      try {
        const api = await getAgent();
        await api.updateWorkspace({ id, ...updates });
        const { profileId, ...workspaceUpdates } = updates;
        updateWorkspaceInList(
          id,
          profileId === undefined
            ? workspaceUpdates
            : { ...workspaceUpdates, profileId: profileId ?? undefined },
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update workspace");
      }
    },
    [updateWorkspaceInList],
  );

  const archiveWorkspace = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        await api.archiveWorkspace({ id });
        if (activeWorkspaceId === id) localStorage.removeItem("helix.active-workspace-id");
        removeWorkspaceFromList(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to archive workspace");
      }
    },
    [activeWorkspaceId, removeWorkspaceFromList],
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        await api.deleteWorkspace({ id });
        if (activeWorkspaceId === id) localStorage.removeItem("helix.active-workspace-id");
        removeWorkspaceFromList(id);
        setDocuments([]);
        setMemoryFacts([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete workspace");
      }
    },
    [activeWorkspaceId, removeWorkspaceFromList, setMemoryFacts],
  );

  const attachDocument = useCallback(async (workspaceId: string, documentId: string) => {
    try {
      const api = await getAgent();
      await api.attachDocumentToWorkspace({ workspaceId, documentId });
      const attached = await api.listWorkspaceDocuments({ workspaceId });
      setDocuments(attached);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach document");
    }
  }, []);

  const detachDocument = useCallback(async (workspaceId: string, documentId: string) => {
    try {
      const api = await getAgent();
      await api.detachDocumentFromWorkspace({ workspaceId, documentId });
      setDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to detach document");
    }
  }, []);

  const addMemoryFact = useCallback(
    async (workspaceId: string, content: string): Promise<string | null> => {
      try {
        const api = await getAgent();
        const { id } = await api.addMemoryFact({ workspaceId, content, origin: "manual" });
        const fact: MemoryFact = {
          id,
          content,
          origin: "manual",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addMemoryFactToStore(fact);
        return id;
      } catch {
        return null;
      }
    },
    [addMemoryFactToStore],
  );

  const updateMemoryFact = useCallback(
    async (id: string, updates: { content?: string; status?: "active" | "archived" }) => {
      try {
        const api = await getAgent();
        await api.updateMemoryFact({ id, ...updates });
        updateMemoryFactInStore(id, updates);
      } catch {
        // ignore
      }
    },
    [updateMemoryFactInStore],
  );

  const deleteMemoryFact = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        await api.deleteMemoryFact({ id });
        removeMemoryFactFromStore(id);
      } catch {
        // ignore
      }
    },
    [removeMemoryFactFromStore],
  );

  const linkConversation = useCallback(async (workspaceId: string, conversationId: string) => {
    try {
      const api = await getAgent();
      await api.linkConversationToWorkspace({ workspaceId, conversationId });
    } catch {
      // ignore
    }
  }, []);

  const addFilesAsMemory = useCallback(
    async (workspaceId: string): Promise<number> => {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ multiple: true });
        if (!selected) return 0;
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length === 0) return 0;

        const api = await getAgent();
        const { files } = await api.readFileContext({ paths });
        let added = 0;

        for (const file of files) {
          if (file.content?.trim()) {
            const truncated = file.content.length > 2000 ? `${file.content.slice(0, 2000)}…` : file.content;
            const factContent = `[${file.displayName}]\n${truncated}`;
            const { id } = await api.addMemoryFact({
              workspaceId,
              content: factContent,
              origin: "manual",
            });
            const fact: MemoryFact = {
              id,
              content: factContent,
              origin: "manual",
              status: "active",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            addMemoryFactToStore(fact);
            added++;
          }

          const doc = await api.saveParsedDocument({
            document: {
              path: file.path,
              displayName: file.displayName,
              size: file.size,
              mimeType: file.mimeType,
              encoding: file.encoding,
              content: file.content,
              preview: file.preview,
              parsedFormat: file.parsedFormat,
              parsedMetadata: file.parsedMetadata,
              status: "done",
            },
          });
          await api.attachDocumentToWorkspace({ workspaceId, documentId: doc.id });
        }

        const attached = await api.listWorkspaceDocuments({ workspaceId });
        setDocuments(attached);
        return added;
      } catch {
        return 0;
      }
    },
    [addMemoryFactToStore],
  );

  const activeWorkspace: Workspace | null = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    memoryFacts,
    documents,
    availableDocuments,
    loading,
    error,
    refresh,
    createWorkspace,
    selectWorkspace,
    updateWorkspace,
    archiveWorkspace,
    deleteWorkspace,
    attachDocument,
    detachDocument,
    addMemoryFact,
    addFilesAsMemory,
    updateMemoryFact,
    deleteMemoryFact,
    linkConversation,
  };
}
