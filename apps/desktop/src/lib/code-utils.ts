import { isTauriRuntime } from "./window";

export const languageFilenameMap: Record<string, string> = {
  javascript: "script.js",
  js: "script.js",
  typescript: "script.ts",
  ts: "script.ts",
  tsx: "component.tsx",
  python: "script.py",
  py: "script.py",
  bash: "script.sh",
  sh: "script.sh",
  shell: "script.sh",
  zsh: "script.sh",
  html: "index.html",
  htm: "index.html",
  css: "style.css",
  json: "data.json",
  markdown: "notes.md",
  md: "notes.md",
  yaml: "config.yaml",
  yml: "config.yml",
  sql: "query.sql",
  rust: "main.rs",
  go: "main.go",
  java: "Main.java",
  c: "main.c",
  cpp: "main.cpp",
  "c++": "main.cpp",
};

export function getCodeFilename(language: string): string {
  const normalized = language.trim().toLowerCase();
  return languageFilenameMap[normalized] ?? "snippet.txt";
}

export function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  if (normalized === "sh") return "bash";
  if (normalized === "js") return "javascript";
  if (normalized === "ts") return "typescript";
  if (normalized === "py") return "python";
  if (normalized === "md") return "markdown";
  if (normalized === "yml") return "yaml";
  if (normalized === "htm") return "html";
  return normalized;
}

export async function copyToClipboard(code: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(code);
    return;
  }

  if (isTauriRuntime()) {
    try {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(code);
      return;
    } catch {
      // fall through to fallback
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = code;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } catch (err) {
    console.error("Failed to copy code to clipboard:", err);
  }
  document.body.removeChild(textarea);
}

export function downloadFile(code: string, filename: string): void {
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
