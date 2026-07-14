import { convertFileSrc } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  Braces,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Link2,
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
import { MarkdownRenderer } from "../../../components/ui/content/markdown-renderer";
import { Button } from "../../../components/ui/primitives/button";
import { useDragDrop } from "../hooks/useDragDrop";
import type { HelixMode } from "../types";
import type { ParseJob, ParserModeState } from "./useParserMode";

type Props = {
  variant: "compact" | "expanded";
  parser: ParserModeState;
  onBack: () => void;
  setQuery: (q: string) => void;
  setMode: (m: HelixMode) => void;
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
};

export function ParserModePanel({ variant, parser, onBack, setQuery, setMode, onToastError }: Props) {
  const { t } = useTranslation("helix");
  const compact = variant === "compact";
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
    <div className={`flex h-full min-h-0 flex-col ${compact ? "gap-3" : "gap-4"}`}>
      <div className={`flex border-b border-line ${compact ? "flex-col gap-2 pb-2" : "gap-3 pb-3"}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0 px-2">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("helix:normalCommandView.back")}
          </Button>
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
          {!compact && (
            <p className="ml-2 min-w-0 truncate text-xs text-faint">{t("helix:parserMode.description")}</p>
          )}
        </div>
        {parser.jobs.length > 0 && (
          <div className={`flex gap-1 ${compact ? "w-full justify-end" : "shrink-0"}`}>
            <Button variant="ghost" size="sm" onClick={handleIndexFolder}>
              <FolderOpen className="w-3.5 h-3.5" />
              <span className={compact ? "sr-only" : undefined}>{t("helix:parserMode.indexFolder")}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={parser.clearAll}>
              <Trash2 className="w-3.5 h-3.5" />
              <span className={compact ? "sr-only" : undefined}>{t("helix:parserMode.clearAll")}</span>
            </Button>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />

      {parser.lastImprovedPath && (
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-good/20 bg-good/[0.06] px-3 py-2 text-xs text-good">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" title={parser.lastImprovedPath}>
            {t("helix:parserMode.improvedAt", { path: parser.lastImprovedPath.split(/[/\\]/).pop() })}
          </span>
        </div>
      )}

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
            compact={compact}
            job={parser.selectedJob}
            onRename={(name) => parser.selectedJob && parser.renameFile(parser.selectedJob.path, name)}
            onCopy={() => parser.selectedJob && parser.copyContent(parser.selectedJob.path)}
            onDownloadMd={() => parser.selectedJob && parser.downloadContent(parser.selectedJob.path, "md")}
            onDownloadTxt={() => parser.selectedJob && parser.downloadContent(parser.selectedJob.path, "txt")}
            onSendToChat={() =>
              parser.selectedJob && parser.sendToChat(parser.selectedJob.path, setQuery, setMode)
            }
            onAttachToSpace={
              parser.activeSpaceId && parser.selectedJob?.id
                ? () => parser.selectedJob && parser.attachToSpace(parser.selectedJob.path)
                : undefined
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
  const { t } = useTranslation("helix");
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
      <div className="mt-3 grid w-full max-w-md grid-cols-2 border-t border-line pt-3 text-left">
        <div className="flex items-start gap-2 border-r border-line px-3">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
          <div>
            <strong className="block text-[10px] font-medium text-mute">
              {t("helix:parserMode.documentPipeline")}
            </strong>
            <span className="text-[9px] text-faint">LiteParse</span>
          </div>
        </div>
        <div className="flex items-start gap-2 px-3">
          <ScanText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" />
          <div>
            <strong className="block text-[10px] font-medium text-mute">
              {t("helix:parserMode.imagePipeline")}
            </strong>
            <span className="text-[9px] text-faint">Apple Vision · on-device</span>
          </div>
        </div>
      </div>
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
          className={`group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md px-2 py-1.5 transition-all duration-200 ${
            selectedPath === job.path
              ? "bg-signal/[0.1] border border-signal/20"
              : "hover:bg-white/[0.04] border border-transparent active:scale-[0.98]"
          }`}
        >
          <button
            type="button"
            className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-0.5 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            onClick={() => onSelect(job.path)}
          >
            <StatusIcon status={job.status} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-medium text-fg" title={job.displayName}>
                {job.displayName}
              </span>
              <span className="truncate text-[10px] text-faint">
                {job.format ?? ""}
                {job.metadata?.vision ? ` · ${t("helix:parserMode.appleVision")}` : ""}
                {job.metadata && "pages" in job.metadata
                  ? ` · ${job.metadata.pages} ${t("helix:parserMode.pages")}`
                  : ""}
                {job.size > 0 ? ` · ${formatFileSize(job.size)}` : ""}
              </span>
            </div>
          </button>
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint opacity-60 transition-all duration-200 hover:bg-bad/10 hover:text-bad hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad/40"
            aria-label={t("helix:parserMode.removeFile")}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(job.path);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
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
  compact,
  onRename,
  onCopy,
  onDownloadMd,
  onDownloadTxt,
  onSendToChat,
  onAttachToSpace,
  onImprove,
  improving,
}: {
  job: ParseJob | null;
  compact: boolean;
  onRename: (name: string) => void;
  onCopy: () => void;
  onDownloadMd: () => void;
  onDownloadTxt: () => void;
  onSendToChat: () => void;
  onAttachToSpace?: () => void;
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
    const visionFailure = job.format === "image" || job.error?.startsWith("Apple Vision:");
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-line bg-white/[0.02]">
        {visionFailure ? <ScanText className="h-6 w-6 text-bad" /> : <XCircle className="h-6 w-6 text-bad" />}
        <span className="text-xs text-bad">
          {t(visionFailure ? "helix:parserMode.visionError" : "helix:parserMode.error")}
        </span>
        <span className="max-w-md text-center text-[11px] text-faint">{job.error}</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-64 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-white/[0.02]">
      <div
        className={`flex shrink-0 border-b border-line bg-white/[0.015] ${compact ? "flex-col" : "items-center"}`}
      >
        <div className={`flex min-w-0 items-center gap-2 px-3 py-2 ${compact ? "w-full" : "mr-auto w-56"}`}>
          <div className="min-w-0 flex-1">
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
              {job.metadata?.vision ? ` · ${t("helix:parserMode.appleVision")}` : ""}
              {job.size > 0 ? ` · ${formatFileSize(job.size)}` : ""}
            </p>
          </div>
          {compact && (
            <fieldset className="flex shrink-0 rounded-lg border border-line bg-ink/20 p-0.5">
              <ViewToggle view={view} setView={setView} compact />
            </fieldset>
          )}
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1.5 ${compact ? "w-full border-t border-line/60" : ""}`}
        >
          {!compact && (
            <fieldset className="mr-1 flex rounded-lg border border-line bg-ink/20 p-0.5">
              <ViewToggle view={view} setView={setView} />
            </fieldset>
          )}
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
            {!compact && ".md"}
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
            {!compact && ".txt"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onSendToChat} className="ml-auto shrink-0">
            <Send className="w-3.5 h-3.5" />
            {!compact && t("helix:parserMode.sendToChat")}
          </Button>
          {onAttachToSpace && (
            <Button variant="ghost" size="sm" onClick={onAttachToSpace} className="shrink-0">
              <Link2 className="h-3.5 w-3.5" />
              {!compact && t("helix:parserMode.addToSpace")}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onImprove} disabled={improving} className="shrink-0">
            {improving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {t(improving ? "helix:parserMode.improving" : "helix:parserMode.improveWithAi")}
          </Button>
        </div>
      </div>
      <div
        key={job.path + view}
        className={`helix-view-enter min-h-0 flex-1 overflow-y-auto ${compact ? "px-3 py-3" : "px-5 py-4"}`}
      >
        {view === "preview" && job.format === "image" ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4">
            {Boolean(job.metadata?.vision) && (
              <div className="flex items-center gap-1.5 self-start rounded-full border border-good/20 bg-good/[0.06] px-2.5 py-1 text-[9px] font-medium text-good">
                <ScanText className="h-3 w-3" />
                {t("helix:parserMode.visionOnDevice")}
              </div>
            )}
            <img
              src={convertFileSrc(job.path)}
              alt={job.displayName}
              className="max-h-[28rem] max-w-full rounded-lg border border-line object-contain"
            />
            {job.content && <MarkdownRenderer content={job.content} className="w-full max-w-4xl" />}
          </div>
        ) : view === "preview" ? (
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

function ViewToggle({
  view,
  setView,
  compact = false,
}: {
  view: "preview" | "source";
  setView: (view: "preview" | "source") => void;
  compact?: boolean;
}) {
  const { t } = useTranslation("helix");
  return (
    <>
      <button
        type="button"
        onClick={() => setView("preview")}
        aria-pressed={view === "preview"}
        title={t("helix:parserMode.preview")}
        className={`flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition-colors ${view === "preview" ? "bg-white/[0.08] text-fg" : "text-faint hover:text-mute"}`}
      >
        <ScanText className="h-3 w-3" />
        {!compact && t("helix:parserMode.preview")}
      </button>
      <button
        type="button"
        onClick={() => setView("source")}
        aria-pressed={view === "source"}
        title={t("helix:parserMode.source")}
        className={`flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition-colors ${view === "source" ? "bg-white/[0.08] text-fg" : "text-faint hover:text-mute"}`}
      >
        <Braces className="h-3 w-3" />
        {!compact && t("helix:parserMode.source")}
      </button>
    </>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
