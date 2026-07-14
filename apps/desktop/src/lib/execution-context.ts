import type {
  ContextAttachment,
  ExecutionContextSnapshot,
  ExecutionContextSummary,
  FileContextInput,
  WorkflowRun,
  WorkflowStep,
} from "@desktop-agent/shared";

const SENSITIVE_VALUE_PATTERN = /(sk-[\w-]{8,}|gh[pousr]_[A-Za-z0-9]+|bearer\s+[\w.+/=-]+)/gi;
const SENSITIVE_KEY_PATTERN = /api[-_]?key|authorization|token|secret|password/i;
const WRITE_TOOLS = new Set(["desktop.file.write", "file.patch", "desktop.file.patch"]);

function safePreview(value: unknown, limit = 500): string {
  if (value == null) return "";
  let text: string;
  try {
    text = JSON.stringify(value, (key, nested) => (SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : nested));
  } catch {
    text = String(value);
  }
  return text.replace(SENSITIVE_VALUE_PATTERN, "[redacted]").slice(0, limit);
}

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function durationMs(step: WorkflowStep): number {
  if (!step.startedAt || !step.completedAt) return 0;
  const duration = Date.parse(step.completedAt) - Date.parse(step.startedAt);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function writtenFile(step: WorkflowStep): ExecutionContextSummary["filesWritten"][number] | null {
  if (!step.toolName || !WRITE_TOOLS.has(step.toolName)) return null;
  const input = typeof step.input === "object" && step.input ? (step.input as Record<string, unknown>) : {};
  const output =
    typeof step.output === "object" && step.output ? (step.output as Record<string, unknown>) : {};
  const path = String(output.path ?? output.filePath ?? input.path ?? input.filePath ?? "").trim();
  if (!path) return null;
  return {
    displayName: fileName(path),
    preview: safePreview(step.output || step.input, 300),
    mimeType: "text/plain",
  };
}

export function buildExecutionContextSummary(input: {
  snapshot: ExecutionContextSnapshot | null;
  run: WorkflowRun;
  files: FileContextInput[];
  contexts: ContextAttachment[];
  spaceName?: string;
}): ExecutionContextSummary {
  const filesByPath = new Map(input.files.map((file) => [file.path, file]));
  const filesRead: ExecutionContextSummary["filesRead"] = [];
  const seen = new Set<string>();

  for (const source of input.snapshot?.sources ?? []) {
    seen.add(source.documentId);
    filesRead.push({
      displayName: source.displayName,
      preview: source.preview,
      mimeType: source.mimeType,
      source: "space",
    });
  }

  for (const path of input.snapshot?.fileContextPaths ?? input.files.map((file) => file.path)) {
    const file = filesByPath.get(path);
    const key = path;
    if (seen.has(key)) continue;
    seen.add(key);
    filesRead.push({
      displayName: file?.displayName ?? fileName(path),
      preview: file?.preview ?? "",
      mimeType: file?.mimeType ?? "application/octet-stream",
      source: "attachment",
    });
  }

  for (const context of input.contexts.filter((item) => item.enabled && item.source === "file")) {
    if (seen.has(context.id)) continue;
    seen.add(context.id);
    filesRead.push({
      displayName: context.label,
      preview: context.preview,
      mimeType: String(context.metadata?.mimeType ?? "application/octet-stream"),
      source: "context",
    });
  }

  const steps = input.run.steps ?? [];
  const toolsUsed = steps
    .filter((step) => step.kind === "tool" || step.kind === "mcp")
    .map((step) => ({
      toolName: step.toolName ?? step.mcpServerId ?? step.title,
      inputPreview: safePreview(step.input),
      outputPreview: safePreview(step.errorMessage ?? step.output),
      durationMs: durationMs(step),
      success: step.status === "completed",
    }));
  const filesWritten = steps
    .map(writtenFile)
    .filter((file): file is NonNullable<typeof file> => Boolean(file));

  return {
    runId: input.run.id,
    spaceName: input.spaceName,
    facts: input.snapshot?.facts ?? [],
    filesRead,
    filesWritten,
    toolsUsed,
    instructions: input.snapshot?.instructions ?? "",
  };
}

export function hasExecutionContext(summary: ExecutionContextSummary): boolean {
  return Boolean(
    summary.facts.length ||
      summary.filesRead.length ||
      summary.filesWritten.length ||
      summary.toolsUsed.length ||
      summary.instructions.trim(),
  );
}
