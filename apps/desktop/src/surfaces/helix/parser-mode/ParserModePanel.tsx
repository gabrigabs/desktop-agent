import {
  ArrowLeft,
  Braces,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Pencil,
  ScanText,
  Send,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/button";
import { MarkdownRenderer } from "../../../components/ui/markdown-renderer";
import { useDragDrop } from "../hooks/useDragDrop";
import type { HelixMode } from "../types";
import type { ParseJob, ParserModeState } from "./useParserMode";

type Props = {
  parser: ParserModeState;
  onBack: () => void;
  setQuery: (q: string) => void;
  setMode: (m: HelixMode) => void;
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
};

export function ParserModePanel({ parser, onBack, setQuery, setMode, onToastError }: Props) {
  const { t } = useTranslation("helix");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isDragging } = useDragDrop(parser.addFiles);

  const handleSelectFiles = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: true });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        await parser.addFiles(paths);
      }
    } catch {
      fileInputRef.current?.click();
    }
  }, [parser]);

  const handleIndexFolder = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") await parser.indexMarkdownFolder(selected);
    } catch (err) {
      onToastError?.(err instanceof Error ? err.message : String(err));
    }
  }, [onToastError, parser]);

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      const fileJobs: ParseJob[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f) continue;
        if (!f.type.startsWith("text/") && !/\.(md|markdown|csv|json|ya?ml|txt)$/i.test(f.name)) {
          onToastError?.(t("helix:parserMode.nativeRequired"));
          continue;
        }
        const text = await f.text();
        fileJobs.push({
          path: f.name,
          displayName: f.name,
          size: f.size,
          status: "done",
          content: text,
          preview: text.slice(0, 500),
          format: f.type || "text/plain",
        });
      }
      if (fileJobs.length > 0) {
        parser.addWebFiles(fileJobs);
      }
      e.target.value = "";
    },
    [onToastError, parser, t],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-start gap-3 border-b border-line pb-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("helix:normalCommandView.back")}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-fg">{t("helix:parserMode.title")}</span>
            {parser.jobs.length > 0 && (
              <span className="rounded-full bg-signal/10 px-2 py-0.5 text-[10px] font-semibold text-signal">
                {t("helix:parserMode.fileCount", { count: parser.jobs.length })}
              </span>
            )}
            {parser.sources.length > 0 && (
              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-mute">
                {t("helix:parserMode.sourceCount", { count: parser.sources.length })}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-faint">{t("helix:parserMode.description")}</p>
        </div>
        {parser.jobs.length > 0 && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleIndexFolder}>
              <FolderOpen className="w-3.5 h-3.5" />
              {t("helix:parserMode.indexFolder")}
            </Button>
            <Button variant="ghost" size="sm" onClick={parser.clearAll}>
              <Trash2 className="w-3.5 h-3.5" />
              {t("helix:parserMode.clearAll")}
            </Button>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />

      {parser.jobs.length === 0 ? (
        <DropZone
          isDragging={isDragging}
          onSelectFiles={handleSelectFiles}
          dropHint={t("helix:parserMode.dropHint")}
          selectLabel={t("helix:parserMode.selectFiles")}
          onIndexFolder={handleIndexFolder}
          indexFolderLabel={t("helix:parserMode.indexFolder")}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <FileList
            jobs={parser.jobs}
            selectedPath={parser.selectedPath}
            onSelect={parser.selectFile}
            onRemove={parser.removeFile}
            onAdd={handleSelectFiles}
          />
          <PreviewPane
            job={parser.selectedJob}
            onRename={(name) => parser.selectedJob && parser.renameFile(parser.selectedJob.path, name)}
            onCopy={() => parser.selectedJob && parser.copyContent(parser.selectedJob.path)}
            onDownloadMd={() => parser.selectedJob && parser.downloadContent(parser.selectedJob.path, "md")}
            onDownloadTxt={() => parser.selectedJob && parser.downloadContent(parser.selectedJob.path, "txt")}
            onSendToChat={() =>
              parser.selectedJob && parser.sendToChat(parser.selectedJob.path, setQuery, setMode)
            }
            improving={parser.improvingPath === parser.selectedJob?.path}
            onImprove={() => {
              if (!parser.selectedJob) return;
              if (
                window.confirm(t("helix:parserMode.improveConfirm", { name: parser.selectedJob.displayName }))
              ) {
                void parser.improveFile(parser.selectedJob.path);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

function DropZone({
  isDragging,
  onSelectFiles,
  dropHint,
  selectLabel,
  onIndexFolder,
  indexFolderLabel,
}: {
  isDragging: boolean;
  onSelectFiles: () => void;
  dropHint: string;
  selectLabel: string;
  onIndexFolder: () => void;
  indexFolderLabel: string;
}) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all duration-200 ${
        isDragging
          ? "scale-[1.01] border-signal/50 bg-signal/[0.06]"
          : "border-line bg-white/[0.02] hover:border-signal/30 hover:bg-signal/[0.03] active:scale-[0.99]"
      }`}
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-signal/[0.08] transition-transform duration-200 ${isDragging ? "scale-110" : ""}`}
      >
        <FileText className="h-7 w-7 text-signal" />
      </div>
      <span className="text-sm text-mute">{dropHint}</span>
      <button
        type="button"
        onClick={onSelectFiles}
        className="rounded-lg border border-signal/20 bg-signal/[0.06] px-3 py-1.5 text-xs font-medium text-signal"
      >
        {selectLabel}
      </button>
      <button
        type="button"
        onClick={onIndexFolder}
        className="flex items-center gap-1 text-xs text-faint hover:text-mute"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        {indexFolderLabel}
      </button>
    </div>
  );
}

function FileList({
  jobs,
  selectedPath,
  onSelect,
  onRemove,
  onAdd,
}: {
  jobs: ParseJob[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onRemove: (path: string) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation("helix");
  return (
    <div className="flex max-h-44 w-full shrink-0 flex-col gap-1.5 overflow-y-auto rounded-xl border border-line bg-white/[0.02] p-2 lg:max-h-none lg:w-64">
      <button
        type="button"
        onClick={onAdd}
        className="mb-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-signal/25 px-3 py-2 text-xs font-medium text-signal transition-all duration-200 hover:bg-signal/[0.06] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
      >
        <FileText className="h-3.5 w-3.5" />
        {t("helix:parserMode.addFiles")}
      </button>
      {jobs.map((job) => (
        <div
          key={job.path}
          className={`group flex items-center gap-2 rounded-md px-2.5 py-2 transition-all duration-200 ${
            selectedPath === job.path
              ? "bg-signal/[0.1] border border-signal/20"
              : "hover:bg-white/[0.04] border border-transparent active:scale-[0.98]"
          }`}
        >
          <button
            type="button"
            className="flex flex-1 cursor-pointer items-center gap-2 text-left"
            onClick={() => onSelect(job.path)}
          >
            <StatusIcon status={job.status} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-medium text-fg" title={job.displayName}>
                {job.displayName}
              </span>
              <span className="truncate text-[10px] text-faint">
                {job.format ?? ""}
                {job.metadata && "pages" in job.metadata
                  ? ` · ${job.metadata.pages} ${t("helix:parserMode.pages")}`
                  : ""}
                {job.size > 0 ? ` · ${formatFileSize(job.size)}` : ""}
              </span>
            </div>
          </button>
          <button
            type="button"
            className="opacity-0 transition-all duration-200 group-hover:opacity-100 hover:scale-110"
            aria-label={t("helix:parserMode.removeFile")}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(job.path);
            }}
          >
            <Trash2 className="h-3 w-3 text-faint hover:text-bad" />
          </button>
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: ParseJob["status"] }) {
  switch (status) {
    case "parsing":
      return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-signal" />;
    case "done":
      return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-good" />;
    case "error":
      return <XCircle className="h-3.5 w-3.5 shrink-0 text-bad" />;
    default:
      return <FileText className="h-3.5 w-3.5 shrink-0 text-faint" />;
  }
}

function PreviewPane({
  job,
  onRename,
  onCopy,
  onDownloadMd,
  onDownloadTxt,
  onSendToChat,
  onImprove,
  improving,
}: {
  job: ParseJob | null;
  onRename: (name: string) => void;
  onCopy: () => void;
  onDownloadMd: () => void;
  onDownloadTxt: () => void;
  onSendToChat: () => void;
  onImprove: () => void;
  improving: boolean;
}) {
  const { t } = useTranslation("helix");
  const [view, setView] = useState<"preview" | "source">("preview");
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(job?.displayName ?? "");

  const commitName = () => {
    if (name.trim()) onRename(name);
    else setName(job?.displayName ?? "");
    setEditingName(false);
  };

  if (!job) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-line bg-white/[0.02]">
        <span className="text-sm text-faint">{t("helix:parserMode.noPreview")}</span>
      </div>
    );
  }

  if (job.status === "parsing") {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-line bg-white/[0.02]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-signal" />
          <span className="text-xs text-mute">{t("helix:parserMode.parsing")}</span>
        </div>
      </div>
    );
  }

  if (job.status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-line bg-white/[0.02]">
        <XCircle className="h-6 w-6 text-bad" />
        <span className="text-xs text-bad">{t("helix:parserMode.error")}</span>
        <span className="max-w-md text-center text-[11px] text-faint">{job.error}</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-64 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-white/[0.02]">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-white/[0.015] px-2 py-2">
        <div className="mr-auto w-44 shrink-0 px-2">
          {editingName ? (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitName();
                if (event.key === "Escape") {
                  setName(job.displayName);
                  setEditingName(false);
                }
              }}
              className="w-full rounded border border-signal/30 bg-ink/40 px-1.5 py-0.5 text-xs font-semibold text-fg outline-none"
              aria-label={t("helix:parserMode.rename")}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setName(job.displayName);
                setEditingName(true);
              }}
              className="flex max-w-full items-center gap-1 text-left text-xs font-semibold text-fg"
              title={t("helix:parserMode.rename")}
            >
              <span className="truncate">{job.displayName}</span>
              <Pencil className="h-3 w-3 shrink-0 text-faint" />
            </button>
          )}
          <p className="text-[10px] uppercase tracking-wider text-faint">
            {job.format ?? "document"}
            {job.metadata && "pages" in job.metadata
              ? ` · ${job.metadata.pages} ${t("helix:parserMode.pages")}`
              : ""}
            {job.size > 0 ? ` · ${formatFileSize(job.size)}` : ""}
          </p>
        </div>
        <fieldset className="mr-1 flex rounded-lg border border-line bg-ink/20 p-0.5">
          <button
            type="button"
            onClick={() => setView("preview")}
            aria-pressed={view === "preview"}
            className={`flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition-colors ${
              view === "preview" ? "bg-white/[0.08] text-fg" : "text-faint hover:text-mute"
            }`}
          >
            <ScanText className="h-3 w-3" />
            {t("helix:parserMode.preview")}
          </button>
          <button
            type="button"
            onClick={() => setView("source")}
            aria-pressed={view === "source"}
            className={`flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition-colors ${
              view === "source" ? "bg-white/[0.08] text-fg" : "text-faint hover:text-mute"
            }`}
          >
            <Braces className="h-3 w-3" />
            {t("helix:parserMode.source")}
          </button>
        </fieldset>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          aria-label={t("helix:parserMode.copy")}
          title={t("helix:parserMode.copy")}
          className="px-2"
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDownloadMd}
          aria-label={t("helix:parserMode.downloadMarkdown")}
          title={t("helix:parserMode.downloadMarkdown")}
          className="px-2"
        >
          <Download className="w-3.5 h-3.5" />
          .md
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDownloadTxt}
          aria-label={t("helix:parserMode.downloadText")}
          title={t("helix:parserMode.downloadText")}
          className="px-2"
        >
          <Download className="w-3.5 h-3.5" />
          .txt
        </Button>
        <Button variant="primary" size="sm" onClick={onSendToChat} className="shrink-0">
          <Send className="w-3.5 h-3.5" />
          {t("helix:parserMode.sendToChat")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onImprove} disabled={improving} className="shrink-0">
          {improving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {t(improving ? "helix:parserMode.improving" : "helix:parserMode.improveWithAi")}
        </Button>
      </div>
      <div key={job.path + view} className="helix-view-enter min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {view === "preview" ? (
          <MarkdownRenderer
            key={`${job.path}-preview`}
            content={job.content ?? job.preview ?? ""}
            className="max-w-4xl"
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-fg/90">
            {job.content ?? job.preview ?? ""}
          </pre>
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
