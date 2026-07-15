import type { FileContextInput, MarkdownSource, ParsedDocument } from "@desktop-agent/shared";
import { useCallback, useEffect, useState } from "react";
import { getAgent } from "../../../lib/rpc";
import { enrichFileContextWithAppleVision } from "../../../lib/vision-file-context";
import { useAgentStore } from "../../../stores/agent";

export type ParseJob = {
  id?: string;
  path: string;
  displayName: string;
  size: number;
  status: "pending" | "parsing" | "done" | "error";
  error?: string;
  content?: string;
  preview?: string;
  format?: string;
  metadata?: Record<string, unknown>;
  fileContext?: FileContextInput;
};

export type ParserModeState = ReturnType<typeof useParserMode>;

function parsedDocumentToParseJob(doc: ParsedDocument): ParseJob {
  return {
    id: doc.id,
    path: doc.path,
    displayName: doc.displayName,
    size: doc.size,
    status: doc.status,
    error: doc.error,
    content: doc.content,
    preview: doc.preview,
    format: doc.parsedFormat ?? doc.mimeType,
    metadata: doc.parsedMetadata,
    fileContext: {
      path: doc.path,
      displayName: doc.displayName,
      size: doc.size,
      mimeType: doc.mimeType,
      encoding: doc.encoding,
      content: doc.content,
      preview: doc.preview,
      parsedFormat: doc.parsedFormat,
      parsedMetadata: doc.parsedMetadata,
    },
  };
}

function parseJobToParsedDocument(job: ParseJob): Omit<ParsedDocument, "id" | "createdAt" | "updatedAt"> {
  return {
    path: job.path,
    displayName: job.displayName,
    size: job.size,
    mimeType: job.fileContext?.mimeType ?? job.format ?? "text/plain",
    encoding: job.fileContext?.encoding ?? "parsed",
    content: job.content,
    preview: job.preview ?? "",
    parsedFormat: job.format as ParsedDocument["parsedFormat"],
    parsedMetadata: job.metadata ?? {},
    status: job.status,
    error: job.error,
  };
}

export function useParserMode(
  onError?: (message: string) => void,
  onToastSuccess?: (message: string) => void,
) {
  const [jobs, setJobs] = useState<ParseJob[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [sources, setSources] = useState<MarkdownSource[]>([]);
  const [improvingPath, setImprovingPath] = useState<string | null>(null);
  const [lastImprovedPath, setLastImprovedPath] = useState<string | null>(null);
  const activeSpaceId = useAgentStore((state) => state.activeSpaceId);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const api = await getAgent();
        const [docs, savedSources] = await Promise.all([
          api.listParsedDocuments({ limit: 100 }),
          api.listMarkdownSources(),
        ]);
        if (!cancelled) {
          setJobs(docs.map(parsedDocumentToParseJob));
          setSources(savedSources);
        }
      } catch (err) {
        console.error("Failed to load parsed documents:", err);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveJob = useCallback(async (job: ParseJob): Promise<void> => {
    try {
      const api = await getAgent();
      const saved = await api.saveParsedDocument({
        document: { ...parseJobToParsedDocument(job), id: job.id },
      });
      setJobs((current) =>
        current.map((item) => (item.path === job.path ? parsedDocumentToParseJob(saved) : item)),
      );
    } catch (err) {
      console.error("Failed to save parsed document:", err);
    }
  }, []);

  const addFiles = useCallback(
    async (paths: string[]): Promise<void> => {
      if (paths.length === 0) return;

      const newJobs: ParseJob[] = paths.map((p) => {
        const parts = p.split(/[/\\]/);
        return {
          path: p,
          displayName: parts[parts.length - 1] || p,
          size: 0,
          status: "parsing" as const,
        };
      });

      setJobs((prev) => {
        const existing = new Set(prev.map((j) => j.path));
        return [...prev, ...newJobs.filter((j) => !existing.has(j.path))];
      });
      setSelectedPath((current) => current ?? newJobs[0]?.path ?? null);

      try {
        const api = await getAgent();
        const result = await api.readFileContext({ paths });
        const parsedFiles = await Promise.all(
          result.files.map((file) => enrichFileContextWithAppleVision(file)),
        );
        const newPaths = new Set(newJobs.map((job) => job.path));

        setJobs((prev) => {
          const updatedJobs = prev.map((job) => {
            if (!newPaths.has(job.path)) return job;
            const file =
              parsedFiles.find((f) => f.path === job.path) ??
              parsedFiles.find((f) => f.displayName === job.displayName);
            const parseError = result.errors.find(
              (error) => error.includes(`Failed to parse ${job.displayName}:`) || error.includes(job.path),
            );
            if (parseError) {
              const updated = { ...job, status: "error" as const, error: parseError };
              void saveJob(updated);
              return updated;
            }
            if (file) {
              if (file.parsedMetadata?.visionError) {
                const updated = {
                  ...job,
                  path: file.path,
                  status: "error" as const,
                  error: `Apple Vision: ${file.parsedMetadata.visionError}`,
                  preview: file.preview,
                  format: "image",
                  metadata: file.parsedMetadata,
                  size: file.size,
                  fileContext: file,
                };
                void saveJob(updated);
                return updated;
              }
              const updated = {
                ...job,
                path: file.path,
                status: "done" as const,
                content: file.content,
                preview: file.preview,
                format: file.parsedFormat ?? file.mimeType,
                metadata: file.parsedMetadata,
                size: file.size,
                fileContext: file,
              };
              void saveJob(updated);
              return updated;
            }
            const err = result.errors.find((e) => e.includes(job.displayName) || e.includes(job.path));
            if (err) {
              const updated = { ...job, status: "error" as const, error: err };
              void saveJob(updated);
              return updated;
            }
            const updated = { ...job, status: "error" as const, error: "No result" };
            void saveJob(updated);
            return updated;
          });
          return updatedJobs;
        });

        if (result.errors.length > 0) {
          onError?.(result.errors.join("\n"));
        }
      } catch (err) {
        const message = `Failed to parse files: ${err instanceof Error ? err.message : String(err)}`;
        onError?.(message);
        setJobs((prev) =>
          prev.map((job) => {
            if (!newJobs.some((nj) => nj.path === job.path)) return job;
            const updated = { ...job, status: "error" as const, error: message };
            void saveJob(updated);
            return updated;
          }),
        );
      }
    },
    [onError, saveJob],
  );

  const addWebFiles = useCallback(
    (webJobs: ParseJob[]) => {
      setJobs((prev) => {
        const existing = new Set(prev.map((j) => j.path));
        return [...prev, ...webJobs.filter((j) => !existing.has(j.path))];
      });
      setSelectedPath((current) => current ?? webJobs[0]?.path ?? null);
      for (const job of webJobs) {
        void saveJob(job);
      }
    },
    [saveJob],
  );

  const indexMarkdownFolder = useCallback(
    async (path: string) => {
      try {
        const api = await getAgent();
        const result = await api.indexMarkdownFolder({ path });
        const indexedJobs = result.documents.map(parsedDocumentToParseJob);
        setJobs((current) => {
          const byPath = new Map(current.map((job) => [job.path, job]));
          for (const job of indexedJobs) byPath.set(job.path, job);
          return Array.from(byPath.values());
        });
        setSources((current) => [
          result.source,
          ...current.filter((source) => source.id !== result.source.id),
        ]);
        setSelectedPath((current) => current ?? indexedJobs[0]?.path ?? null);
        onToastSuccess?.("parserMode.folderIndexed");
      } catch (err) {
        onError?.(`Failed to index Markdown folder: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [onError, onToastSuccess],
  );

  const removeFile = useCallback(
    async (path: string) => {
      const job = jobs.find((item) => item.path === path);
      if (!job) return;
      try {
        if (job.id) {
          const api = await getAgent();
          await api.deleteParsedDocument({ id: job.id });
        }
        setJobs((prev) => {
          const remaining = prev.filter((item) => item.path !== path);
          setSelectedPath((selected) => (selected === path ? (remaining[0]?.path ?? null) : selected));
          return remaining;
        });
        onToastSuccess?.("parserMode.deleted");
      } catch (err) {
        onError?.(`Failed to delete document: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [jobs, onError, onToastSuccess],
  );

  const clearAll = useCallback(async () => {
    try {
      const api = await getAgent();
      await api.deleteAllParsedDocuments();
      setJobs([]);
      setSources([]);
      setSelectedPath(null);
      onToastSuccess?.("parserMode.cleared");
    } catch (err) {
      onError?.(`Failed to clear documents: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [onError, onToastSuccess]);

  const renameFile = useCallback(
    async (path: string, displayName: string) => {
      const job = jobs.find((item) => item.path === path);
      const nextName = displayName.trim();
      if (!job || !nextName || nextName === job.displayName) return;
      try {
        if (job.id) {
          const api = await getAgent();
          const saved = await api.updateParsedDocument({ id: job.id, displayName: nextName });
          setJobs((current) =>
            current.map((item) => (item.path === path ? parsedDocumentToParseJob(saved) : item)),
          );
        } else {
          const updated = { ...job, displayName: nextName };
          setJobs((current) => current.map((item) => (item.path === path ? updated : item)));
          await saveJob(updated);
        }
        onToastSuccess?.("parserMode.renamed");
      } catch (err) {
        onError?.(`Failed to rename document: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [jobs, onError, onToastSuccess, saveJob],
  );

  const copyContent = useCallback(
    (path: string) => {
      const job = jobs.find((j) => j.path === path);
      if (!job?.content) return;
      navigator.clipboard.writeText(job.content);
      onToastSuccess?.("parserMode.copied");
    },
    [jobs, onToastSuccess],
  );

  const downloadContent = useCallback(
    (path: string, format: "md" | "txt") => {
      const job = jobs.find((j) => j.path === path);
      if (!job?.content) return;
      const ext = format === "md" ? ".md" : ".txt";
      const baseName = job.displayName.replace(/\.[^.]+$/, "");
      const blob = new Blob([job.content], { type: format === "md" ? "text/markdown" : "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      onToastSuccess?.("parserMode.downloaded");
    },
    [jobs, onToastSuccess],
  );

  const sendToChat = useCallback(
    (path: string, setQuery: (q: string) => void, setMode: (m: "command") => void, improve = false) => {
      const job = jobs.find((j) => j.path === path);
      if (!job?.content) return;
      const fileContext: FileContextInput = job.fileContext ?? {
        path: job.path,
        displayName: job.displayName,
        size: job.size,
        mimeType: job.format ?? "text/plain",
        encoding: "parsed",
        content: job.content,
        preview: job.preview ?? job.content.slice(0, 500),
      };
      useAgentStore.getState().addFileContext([fileContext]);
      setQuery(
        improve
          ? `Melhore a formatação e a organização dos dados de ${job.displayName}, preservando integralmente os fatos e sinalizando qualquer ambiguidade.`
          : `Analise o documento ${job.displayName}.`,
      );
      setMode("command");
      onToastSuccess?.("parserMode.sentToChat");
    },
    [jobs, onToastSuccess],
  );

  const improveFile = useCallback(
    async (path: string) => {
      const job = jobs.find((item) => item.path === path);
      if (!job?.id) return;
      setImprovingPath(path);
      try {
        const api = await getAgent();
        const result = await api.improveParsedDocument({ id: job.id });
        const improvedJob = parsedDocumentToParseJob(result.document);
        setJobs((current) => {
          const withoutPrevious = current.filter((item) => item.id !== improvedJob.id);
          return [improvedJob, ...withoutPrevious];
        });
        setSelectedPath(improvedJob.path);
        setLastImprovedPath(result.outputPath);
        onToastSuccess?.("parserMode.improved");
      } catch (err) {
        onError?.(`Failed to improve document: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setImprovingPath(null);
      }
    },
    [jobs, onError, onToastSuccess],
  );

  const attachToSpace = useCallback(
    async (path: string) => {
      const job = jobs.find((item) => item.path === path);
      if (!activeSpaceId || !job?.id) return;
      try {
        const api = await getAgent();
        await api.attachDocumentToSpace({ spaceId: activeSpaceId, documentId: job.id });
        onToastSuccess?.("parserMode.addedToSpace");
      } catch (err) {
        onError?.(`Failed to attach document: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [activeSpaceId, jobs, onError, onToastSuccess],
  );

  const selectFile = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  return {
    jobs,
    sources,
    improvingPath,
    lastImprovedPath,
    selectedPath,
    selectedJob: jobs.find((j) => j.path === selectedPath) ?? null,
    activeSpaceId,
    addFiles,
    addWebFiles,
    indexMarkdownFolder,
    removeFile,
    renameFile,
    clearAll,
    copyContent,
    downloadContent,
    sendToChat,
    improveFile,
    attachToSpace,
    selectFile,
  };
}
