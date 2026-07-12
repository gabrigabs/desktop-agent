import path from "node:path";
import type { ParseResult } from "@desktop-agent/lite-parse";
import { isParseable, parseDocument } from "@desktop-agent/lite-parse";
import type { FileContextInput } from "@desktop-agent/shared";

export type ParserResult = {
  path: string;
  displayName: string;
  content?: string;
  preview: string;
  parsedFormat?: FileContextInput["parsedFormat"];
  parsedMetadata?: FileContextInput["parsedMetadata"];
  error?: string;
};

export type ParserAgentConfig = {
  getAuthorizedRoots?: () => string[];
  parseDocument?: (path: string) => Promise<ParseResult>;
};

const NATIVE_PARSE_TIMEOUT_MS = 20_000;

async function parseDocumentIsolated(filePath: string): Promise<ParseResult> {
  if (path.basename(process.execPath) === "bun") {
    return parseDocument(filePath);
  }

  const child = Bun.spawn([process.execPath, "--parse-document", filePath], {
    cwd: path.dirname(process.execPath),
    env: {
      HOME: process.env.HOME ?? "",
      LANG: process.env.LANG ?? "en_US.UTF-8",
      PATH: "/usr/bin:/bin",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const completed = child.exited.then(async (exitCode) => ({
    exitCode,
    stderr: await new Response(child.stderr).text(),
    stdout: await new Response(child.stdout).text(),
  }));
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve(null);
    }, NATIVE_PARSE_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([completed, timedOut]);
    if (!result) return { ok: false, error: "LiteParse timed out after 20 seconds" };
    const { exitCode, stdout, stderr } = result;
    if (exitCode !== 0) {
      return {
        ok: false,
        error: `LiteParse worker failed${stderr.trim() ? `: ${stderr.trim()}` : ""}`,
      };
    }
    try {
      return JSON.parse(stdout) as ParseResult;
    } catch {
      return { ok: false, error: "LiteParse worker returned an invalid response" };
    }
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export class ParserAgent {
  private cache = new Map<string, ParserResult>();
  private config: ParserAgentConfig;

  constructor(config: ParserAgentConfig = {}) {
    this.config = config;
  }

  async parseFiles(paths: string[]): Promise<ParserResult[]> {
    const results: ParserResult[] = [];
    for (const filePath of paths) {
      const cached = this.cache.get(filePath);
      if (cached) {
        results.push(cached);
        continue;
      }
      const result = await this.parseFile(filePath);
      this.cache.set(filePath, result);
      results.push(result);
    }
    return results;
  }

  async parseFileContext(files: FileContextInput[]): Promise<ParserResult[]> {
    const paths = files
      .filter((file) => this.shouldAutoParse(file) && !file.content?.trim())
      .map((file) => file.path);
    return this.parseFiles(paths);
  }

  private shouldAutoParse(file: FileContextInput): boolean {
    if (file.encoding === "binary" && isParseable(file.path)) return true;
    if (file.encoding === "parsed") return true;
    return false;
  }

  private async parseFile(filePath: string): Promise<ParserResult> {
    const displayName = path.basename(filePath);

    if (!isParseable(filePath)) {
      return {
        path: filePath,
        displayName,
        preview: "",
        error: `Formato não suportado para parse automático: ${displayName}`,
      };
    }

    if (!this.isAuthorized(filePath)) {
      return {
        path: filePath,
        displayName,
        preview: "",
        error: `Path fora dos diretórios autorizados: ${displayName}`,
      };
    }

    try {
      const parseFn = this.config.parseDocument ?? parseDocumentIsolated;
      const parseResult = await parseFn(filePath);
      if (parseResult.ok) {
        return {
          path: filePath,
          displayName,
          content: parseResult.document.content,
          preview: parseResult.document.preview,
          parsedFormat: parseResult.document.format,
          parsedMetadata: parseResult.document.metadata,
        };
      }
      return {
        path: filePath,
        displayName,
        preview: "",
        error: parseResult.error,
      };
    } catch (err) {
      return {
        path: filePath,
        displayName,
        preview: "",
        error: `Falha ao parsear arquivo: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private isAuthorized(filePath: string): boolean {
    const roots = this.config.getAuthorizedRoots?.() ?? [];
    if (roots.length === 0) return true;
    const resolved = path.resolve(filePath);
    return roots.some((root) => {
      const normalizedRoot = path.resolve(root);
      return resolved === normalizedRoot || resolved.startsWith(`${normalizedRoot}${path.sep}`);
    });
  }
}
