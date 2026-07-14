import type {
  ParsedDocument,
  Space,
  SpaceCollection,
  SpaceField,
  SpaceRecord,
  SpaceRecordValue,
  SpaceView,
  SpaceViewType,
} from "@desktop-agent/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAgent } from "../../../lib/rpc";
import { useAgentStore } from "../../../stores/agent";

export type CreateSpaceInput = {
  name: string;
  folderPath: string;
  icon?: string;
  color?: string;
  purpose?: string;
  instructions?: string;
  profileId?: string;
  preferredLayout?: "chat" | "collections";
};

export function useSpaces() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ParsedDocument[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<ParsedDocument[]>([]);
  const [collections, setCollections] = useState<SpaceCollection[]>([]);
  const [records, setRecords] = useState<Record<string, SpaceRecord[]>>({});
  const [views, setViews] = useState<SpaceView[]>([]);
  const contextRequest = useRef(0);
  const spaces = useAgentStore((s) => s.spaces);
  const activeSpaceId = useAgentStore((s) => s.activeSpaceId);
  const memoryFacts = useAgentStore((s) => s.memoryFacts);
  const setSpaces = useAgentStore((s) => s.setSpaces);
  const setActiveSpaceId = useAgentStore((s) => s.setActiveSpaceId);
  const setMemoryFacts = useAgentStore((s) => s.setMemoryFacts);
  const addSpace = useAgentStore((s) => s.addSpace);
  const updateSpaceInList = useAgentStore((s) => s.updateSpaceInList);
  const removeSpaceFromList = useAgentStore((s) => s.removeSpaceFromList);
  const addMemoryFactToStore = useAgentStore((s) => s.addMemoryFactToStore);
  const updateMemoryFactInStore = useAgentStore((s) => s.updateMemoryFactInStore);
  const removeMemoryFactFromStore = useAgentStore((s) => s.removeMemoryFactFromStore);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = await getAgent();
      const list = await api.listSpaces();
      setSpaces(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load spaces");
    } finally {
      setLoading(false);
    }
  }, [setSpaces]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createSpace = useCallback(
    async (input: CreateSpaceInput): Promise<string | null> => {
      try {
        const api = await getAgent();
        const space = await api.createSpace(input);
        addSpace(space);
        return space.id;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create space");
        return null;
      }
    },
    [addSpace],
  );

  const loadSpaceContext = useCallback(
    async (id: string) => {
      const requestId = ++contextRequest.current;
      try {
        const api = await getAgent();
        const [facts, attached, allDocuments, nextCollections, nextViews] = await Promise.all([
          api.listMemoryFacts({ spaceId: id }),
          api.listSpaceDocuments({ spaceId: id }),
          api.listParsedDocuments({ limit: 100 }),
          api.listSpaceCollections({ spaceId: id }),
          api.listSpaceViews({ spaceId: id }),
        ]);
        if (requestId !== contextRequest.current) return;
        setMemoryFacts(facts);
        setDocuments(attached);
        setAvailableDocuments(allDocuments);
        setCollections(nextCollections);
        setViews(nextViews);
        setRecords({});
      } catch (err) {
        if (requestId !== contextRequest.current) return;
        setMemoryFacts([]);
        setDocuments([]);
        setError(err instanceof Error ? err.message : "Failed to load space context");
      }
    },
    [setMemoryFacts],
  );

  const selectSpace = useCallback(
    async (id: string | null) => {
      setActiveSpaceId(id);
      if (id) localStorage.setItem("helix.active-space-id", id);
      else localStorage.removeItem("helix.active-space-id");
      if (!id) {
        contextRequest.current++;
        setMemoryFacts([]);
        setDocuments([]);
        setCollections([]);
        setViews([]);
        setRecords({});
      }
    },
    [setActiveSpaceId, setMemoryFacts],
  );

  useEffect(() => {
    if (activeSpaceId) void loadSpaceContext(activeSpaceId);
  }, [activeSpaceId, loadSpaceContext]);

  useEffect(() => {
    if (activeSpaceId || spaces.length === 0) return;
    const savedId = localStorage.getItem("helix.active-space-id");
    if (savedId && spaces.some((space) => space.id === savedId)) {
      void selectSpace(savedId);
    }
  }, [activeSpaceId, selectSpace, spaces]);

  const updateSpace = useCallback(
    async (
      id: string,
      updates: {
        name?: string;
        purpose?: string;
        instructions?: string;
        folderPath?: string;
        icon?: string;
        profileId?: string | null;
        preferredLayout?: "chat" | "collections";
        memoryEnabled?: boolean;
        color?: string;
      },
    ) => {
      try {
        const api = await getAgent();
        const space = await api.updateSpace({ id, ...updates });
        updateSpaceInList(id, space);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update space");
      }
    },
    [updateSpaceInList],
  );

  const archiveSpace = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        await api.archiveSpace({ id });
        if (activeSpaceId === id) localStorage.removeItem("helix.active-space-id");
        removeSpaceFromList(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to archive space");
      }
    },
    [activeSpaceId, removeSpaceFromList],
  );

  const deleteSpace = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        await api.deleteSpace({ id });
        if (activeSpaceId === id) localStorage.removeItem("helix.active-space-id");
        removeSpaceFromList(id);
        setDocuments([]);
        setMemoryFacts([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete space");
      }
    },
    [activeSpaceId, removeSpaceFromList, setMemoryFacts],
  );

  const attachDocument = useCallback(async (spaceId: string, documentId: string) => {
    try {
      const api = await getAgent();
      await api.attachDocumentToSpace({ spaceId, documentId });
      const attached = await api.listSpaceDocuments({ spaceId });
      setDocuments(attached);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach document");
    }
  }, []);

  const detachDocument = useCallback(async (spaceId: string, documentId: string) => {
    try {
      const api = await getAgent();
      await api.detachDocumentFromSpace({ spaceId, documentId });
      setDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to detach document");
    }
  }, []);

  const addMemoryFact = useCallback(
    async (spaceId: string, content: string): Promise<string | null> => {
      try {
        const api = await getAgent();
        const fact = await api.addMemoryFact({ spaceId, content, origin: "manual" });
        addMemoryFactToStore(fact);
        return fact.id;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add memory");
        return null;
      }
    },
    [addMemoryFactToStore],
  );

  const promoteChatResponseToMemoryFact = useCallback(
    async (spaceId: string, content: string, sourceTurnId: string): Promise<string | null> => {
      try {
        const api = await getAgent();
        const fact = await api.addMemoryFact({
          spaceId,
          content,
          origin: "assistant",
          sourceTurnId,
        });
        addMemoryFactToStore(fact);
        return fact.id;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save response to memory");
        return null;
      }
    },
    [addMemoryFactToStore],
  );

  const updateMemoryFact = useCallback(
    async (id: string, updates: { content?: string; status?: "active" | "archived" }) => {
      try {
        const api = await getAgent();
        if (!activeSpaceId) throw new Error("No active space");
        const fact = await api.updateMemoryFact({ spaceId: activeSpaceId, id, ...updates });
        updateMemoryFactInStore(id, fact);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update memory");
      }
    },
    [activeSpaceId, updateMemoryFactInStore],
  );

  const deleteMemoryFact = useCallback(
    async (id: string) => {
      try {
        const api = await getAgent();
        if (!activeSpaceId) throw new Error("No active space");
        await api.deleteMemoryFact({ spaceId: activeSpaceId, id });
        removeMemoryFactFromStore(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete memory");
      }
    },
    [activeSpaceId, removeMemoryFactFromStore],
  );

  const linkConversation = useCallback(async (spaceId: string, conversationId: string) => {
    try {
      const api = await getAgent();
      await api.linkConversationToSpace({ spaceId, conversationId });
    } catch {
      // ignore
    }
  }, []);

  const addFilesAsMemory = useCallback(
    async (spaceId: string): Promise<number> => {
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
            const fact = await api.addMemoryFact({
              spaceId,
              content: factContent,
              origin: "manual",
            });
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
          await api.attachDocumentToSpace({ spaceId, documentId: doc.id });
        }

        const attached = await api.listSpaceDocuments({ spaceId });
        setDocuments(attached);
        return added;
      } catch {
        return 0;
      }
    },
    [addMemoryFactToStore],
  );

  const activeSpace: Space | null = spaces.find((w) => w.id === activeSpaceId) ?? null;

  const loadRecords = useCallback(
    async (collectionId: string) => {
      if (!activeSpaceId) return;
      try {
        const api = await getAgent();
        const list = await api.listSpaceRecords({ spaceId: activeSpaceId, collectionId });
        setRecords((current) => ({ ...current, [collectionId]: list }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load records");
      }
    },
    [activeSpaceId],
  );

  const createCollection = useCallback(
    async (name: string, fields: SpaceField[]) => {
      if (!activeSpaceId) return null;
      try {
        const api = await getAgent();
        const collection = await api.createSpaceCollection({ spaceId: activeSpaceId, name, fields });
        setCollections((current) => [...current, collection]);
        const view = await api.createSpaceView({
          spaceId: activeSpaceId,
          collectionId: collection.id,
          name: "Tabela",
          type: "table",
          config: {},
        });
        setViews((current) => [...current, view]);
        return collection;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create collection");
        return null;
      }
    },
    [activeSpaceId],
  );

  const createView = useCallback(
    async (collectionId: string, name: string, type: SpaceViewType) => {
      if (!activeSpaceId) return null;
      try {
        const api = await getAgent();
        const view = await api.createSpaceView({
          spaceId: activeSpaceId,
          collectionId,
          name,
          type,
          config: {},
        });
        setViews((current) => [...current, view]);
        return view;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create view");
        return null;
      }
    },
    [activeSpaceId],
  );

  const createRecord = useCallback(
    async (collectionId: string, values: Record<string, SpaceRecordValue>) => {
      if (!activeSpaceId) return null;
      try {
        const api = await getAgent();
        const record = await api.createSpaceRecord({ spaceId: activeSpaceId, collectionId, values });
        setRecords((current) => ({
          ...current,
          [collectionId]: [record, ...(current[collectionId] ?? [])],
        }));
        return record;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create record");
        return null;
      }
    },
    [activeSpaceId],
  );

  return {
    spaces,
    activeSpace,
    activeSpaceId,
    memoryFacts,
    documents,
    availableDocuments,
    collections,
    records,
    views,
    loading,
    error,
    refresh,
    createSpace,
    selectSpace,
    updateSpace,
    archiveSpace,
    deleteSpace,
    attachDocument,
    detachDocument,
    addMemoryFact,
    promoteChatResponseToMemoryFact,
    addFilesAsMemory,
    updateMemoryFact,
    deleteMemoryFact,
    linkConversation,
    loadRecords,
    createCollection,
    createRecord,
    createView,
  };
}
