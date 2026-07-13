import { spawn } from "node:child_process";
import type { ConnectorConfig, PermissionLevel } from "@desktop-agent/shared";
import { z } from "@desktop-agent/shared";
import { getMcpServer as getStoredMcpServer } from "@desktop-agent/storage";
import { registry } from "@desktop-agent/tool-registry";

const registeredMcpTools = new Set<string>();
const registeredMcpServers = new Set<string>();

export function mcpToolName(serverId: string, toolName: string): string {
  return `mcp.${serverId}.${toolName}`;
}

export function expandMcpArgs(args: string[] = [], env: Record<string, string | undefined>): string[] {
  return args.map((arg) =>
    arg.replace(/\$(?:\{([A-Z_][A-Z0-9_]*)\}|([A-Z_][A-Z0-9_]*))/gi, (match, braced, plain) => {
      const name = (braced || plain) as string;
      return env[name] ?? match;
    }),
  );
}

export function getHighestPermissionLevel(policy?: PermissionLevel[]): PermissionLevel {
  if (!policy || policy.length === 0) return "external";
  const priority: PermissionLevel[] = [
    "local.read",
    "local.write",
    "screen.read",
    "accessibility.read",
    "notification.send",
    "network",
    "browser.control",
    "external",
  ];
  let highest = policy[0] ?? "external";
  for (const level of policy) {
    if (priority.indexOf(level) > priority.indexOf(highest)) {
      highest = level;
    }
  }
  return highest;
}

export function sendMcpMessage(
  child: import("node:child_process").ChildProcessWithoutNullStreams,
  method: string,
  params: Record<string, unknown>,
) {
  const msg = JSON.stringify({
    jsonrpc: "2.0",
    id: Math.floor(Math.random() * 1e9),
    method,
    params,
  });
  child.stdin.write(`${msg}\n`);
}

export function waitForMcpResponse(
  child: import("node:child_process").ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<{ result?: unknown; error?: { message: string } } | null> {
  return new Promise((resolve) => {
    let buf = "";
    const timer = setTimeout(() => {
      child.stdout.removeAllListeners("data");
      resolve(null);
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.id !== undefined) {
            clearTimeout(timer);
            child.stdout.removeListener("data", onData);
            resolve({ result: parsed.result, error: parsed.error });
            return;
          }
        } catch {
          // ignore non-JSON lines
        }
      }
    };

    child.stdout.on("data", onData);
  });
}

export async function spawnMcpServer(server: ConnectorConfig) {
  const command = server.command;
  if (!command) {
    throw new Error("MCP command is not defined.");
  }

  const childEnv = { ...process.env, ...server.env };
  const child = spawn(command, expandMcpArgs(server.args, childEnv), {
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stderrBuf = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString();
    if (stderrBuf.length > 2000) stderrBuf = stderrBuf.slice(-2000);
  });

  sendMcpMessage(child, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "helix-desktop", version: "1.0.0" },
  });

  const initResult = await waitForMcpResponse(child, 10000);
  if (!initResult) {
    child.stdin.end();
    child.kill("SIGTERM");
    throw new Error("MCP did not respond to initialize.");
  }
  if (initResult.error) {
    child.stdin.end();
    child.kill("SIGTERM");
    throw new Error(initResult.error.message || "MCP initialize failed.");
  }

  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

  return { child, stderrBuf };
}

export function stopMcpServer(child: import("node:child_process").ChildProcessWithoutNullStreams) {
  try {
    child.stdin.end();
    child.kill("SIGTERM");
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // already dead
      }
    }, 2000);
  } catch {
    // already dead
  }
}

export async function executeMcpTool(serverId: string, toolName: string, input: unknown): Promise<unknown> {
  const db = (await import("@desktop-agent/storage")).getDb();
  const server = getStoredMcpServer(db, serverId, true);
  if (!server) throw new Error(`MCP server not found: ${serverId}`);
  if (!server.enabled) throw new Error(`MCP server is disabled: ${serverId}`);

  const missingEnv = Object.entries(server.env ?? {})
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingEnv.length > 0) {
    throw new Error(`Missing environment variables: ${missingEnv.join(", ")}`);
  }

  const { child } = await spawnMcpServer(server);
  try {
    sendMcpMessage(child, "tools/call", { name: toolName, arguments: input });
    const result = await waitForMcpResponse(child, 60000);
    if (!result) throw new Error("MCP did not respond to tools/call.");
    if (result.error) throw new Error(result.error.message || "MCP tools/call failed.");
    return result.result;
  } finally {
    stopMcpServer(child);
  }
}

export async function registerMcpToolsForServer(serverId: string): Promise<void> {
  if (registeredMcpServers.has(serverId)) return;

  const db = (await import("@desktop-agent/storage")).getDb();
  const server = getStoredMcpServer(db, serverId, true);
  if (!server?.enabled) return;
  if (server.command === "direct") {
    registeredMcpServers.add(serverId);
    return;
  }

  const { child } = await spawnMcpServer(server);
  try {
    sendMcpMessage(child, "tools/list", {});
    const result = await waitForMcpResponse(child, 10000);
    if (!result) throw new Error("MCP did not respond to tools/list.");
    if (result.error) throw new Error(result.error.message || "MCP tools/list failed.");

    const tools =
      (result.result as { tools?: { name: string; description?: string }[] } | undefined)?.tools ?? [];

    for (const tool of tools) {
      const name = mcpToolName(serverId, tool.name);
      if (registeredMcpTools.has(name)) continue;
      if (registry.get(name)) continue;

      registry.register({
        name,
        description: tool.description ?? `MCP tool ${tool.name} from ${server.name}`,
        category: "mcp",
        permissionLevel: getHighestPermissionLevel(server.permissionPolicy),
        inputSchema: z.object({}).passthrough(),
        handler: (input: unknown) => executeMcpTool(serverId, tool.name, input),
      });
      registeredMcpTools.add(name);
    }
    registeredMcpServers.add(serverId);
  } finally {
    stopMcpServer(child);
  }
}

export function unregisterMcpToolsForServer(serverId: string): void {
  const prefix = `${mcpToolName(serverId, "")}`;
  for (const name of registeredMcpTools) {
    if (!name.startsWith(prefix)) continue;
    registry.unregister(name);
    registeredMcpTools.delete(name);
  }
  registeredMcpServers.delete(serverId);
}

export async function registerEnabledMcpTools(): Promise<void> {
  const { getDb, listMcpServers } = await import("@desktop-agent/storage");
  const db = getDb();
  const servers = listMcpServers(db, true).filter((s) => s.enabled);
  await Promise.all(
    servers.map((s) =>
      registerMcpToolsForServer(s.id).catch((err) => {
        console.error(`Failed to register MCP tools for ${s.id}:`, err);
      }),
    ),
  );
}
