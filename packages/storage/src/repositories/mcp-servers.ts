import { randomUUID } from "node:crypto";
import type { ConnectorConfig, PermissionLevel } from "@desktop-agent/shared";
import type { Database } from "../db";

type SqlValue = string | number | null;

function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function maskEnv(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, value ? "********" : ""]),
  );
}

export function upsertMcpServer(
  db: Database,
  params: {
    id: string;
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    enabled?: boolean;
    preset?: boolean;
    permissionPolicy?: PermissionLevel[];
  },
): void {
  db.run(
    `INSERT INTO mcp_servers (id, name, command, args_json, env_json, enabled, preset, permission_policy_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       command = excluded.command,
       args_json = excluded.args_json,
       env_json = excluded.env_json,
       enabled = excluded.enabled,
       preset = excluded.preset,
       permission_policy_json = excluded.permission_policy_json,
       updated_at = datetime('now')`,
    [
      params.id,
      params.name,
      params.command,
      stringifyJson(params.args ?? []),
      stringifyJson(params.env ?? {}),
      params.enabled ? 1 : 0,
      params.preset ? 1 : 0,
      stringifyJson(params.permissionPolicy ?? []),
    ],
  );
}

export function createMcpServer(
  db: Database,
  params: {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    enabled?: boolean;
    preset?: boolean;
    permissionPolicy?: PermissionLevel[];
  },
): string {
  const id = randomUUID();
  upsertMcpServer(db, { ...params, id });
  return id;
}

export function updateMcpServerStatus(
  db: Database,
  id: string,
  params: {
    enabled?: boolean;
    lastCheckedAt?: string | null;
    lastError?: string | null;
  },
): void {
  const assignments = ["updated_at = datetime('now')"];
  const values: SqlValue[] = [];

  if (params.enabled !== undefined) {
    assignments.push("enabled = ?");
    values.push(params.enabled ? 1 : 0);
  }
  if (params.lastCheckedAt !== undefined) {
    assignments.push("last_checked_at = ?");
    values.push(params.lastCheckedAt);
  }
  if (params.lastError !== undefined) {
    assignments.push("last_error = ?");
    values.push(params.lastError);
  }

  values.push(id);
  db.run(`UPDATE mcp_servers SET ${assignments.join(", ")} WHERE id = ?`, values);
}

export function getMcpServer(db: Database, id: string, revealSecrets = false): ConnectorConfig | null {
  const row = db.query("SELECT * FROM mcp_servers WHERE id = ?").get(id);
  return row ? mapMcpServer(row, revealSecrets) : null;
}

export function listMcpServers(db: Database, revealSecrets = false): ConnectorConfig[] {
  return db
    .query("SELECT * FROM mcp_servers ORDER BY preset DESC, name ASC")
    .all()
    .map((row) => mapMcpServer(row, revealSecrets));
}

export function deleteMcpServer(db: Database, id: string): void {
  db.run("DELETE FROM mcp_servers WHERE id = ?", [id]);
}

export function ensureDefaultMcpPresets(db: Database): void {
  const presets: Array<{
    id: string;
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    permissionPolicy: PermissionLevel[];
  }> = [
    {
      id: "playwright",
      name: "Playwright MCP",
      command: "npx",
      args: ["-y", "@playwright/mcp@latest"],
      permissionPolicy: ["browser.control", "network"],
    },
    {
      id: "filesystem-scoped",
      name: "Filesystem escopado",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "${HOME}/Desktop"],
      permissionPolicy: ["local.read", "local.write"],
    },
    {
      id: "sqlite-readonly",
      name: "SQLite read-only",
      command: "uvx",
      args: ["mcp-server-sqlite", "--db-path", "${HOME}/.desktop-agent/data.db"],
      permissionPolicy: ["local.read"],
    },
    {
      id: "github",
      name: "GitHub",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
      permissionPolicy: ["network", "external"],
    },
    {
      id: "brave-search",
      name: "Brave Search",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: { BRAVE_API_KEY: "" },
      permissionPolicy: ["network", "external"],
    },
    {
      id: "tavily",
      name: "Tavily",
      command: "npx",
      args: ["-y", "tavily-mcp"],
      env: { TAVILY_API_KEY: "" },
      permissionPolicy: ["network", "external"],
    },
    {
      id: "firecrawl",
      name: "Firecrawl",
      command: "npx",
      args: ["-y", "firecrawl-mcp"],
      env: { FIRECRAWL_API_KEY: "" },
      permissionPolicy: ["network", "external"],
    },
  ];

  for (const preset of presets) {
    const existing = getMcpServer(db, preset.id, true);
    if (existing) continue;
    upsertMcpServer(db, {
      id: preset.id,
      name: preset.name,
      command: preset.command,
      args: preset.args,
      env: preset.env ?? {},
      enabled: false,
      preset: true,
      permissionPolicy: preset.permissionPolicy,
    });
  }
}

function mapMcpServer(row: unknown, revealSecrets: boolean): ConnectorConfig {
  const r = row as Record<string, unknown>;
  const env = parseJson<Record<string, string>>(r.env_json, {});
  return {
    id: r.id as string,
    name: r.name as string,
    kind: "mcp",
    enabled: Boolean(r.enabled),
    command: r.command as string,
    args: parseJson<string[]>(r.args_json, []),
    env: revealSecrets ? env : maskEnv(env),
    preset: Boolean(r.preset),
    permissionPolicy: parseJson<PermissionLevel[]>(r.permission_policy_json, []),
    lastCheckedAt: (r.last_checked_at as string) ?? undefined,
    lastError: (r.last_error as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
