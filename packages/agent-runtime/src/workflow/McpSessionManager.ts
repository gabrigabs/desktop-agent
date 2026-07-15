import type { ConnectorConfig } from "@desktop-agent/shared";
import type { Database } from "@desktop-agent/storage";
import { getMcpServer } from "@desktop-agent/storage";
import { sendMcpMessage, spawnMcpServer, stopMcpServer, waitForMcpResponse } from "../mcp-tools";

export class McpSessionManager {
  private sessions = new Map<
    string,
    { child: import("node:child_process").ChildProcessWithoutNullStreams; stderrBuf: string }
  >();

  constructor(private getDb: () => Database) {}

  async callTool(serverId: string, toolName: string, input: unknown): Promise<unknown> {
    const session = await this.getSession(serverId);
    const callId = sendMcpMessage(session.child, "tools/call", { name: toolName, arguments: input });
    const result = await waitForMcpResponse(session.child, 60000, callId);
    if (!result) throw new Error(`MCP server ${serverId} did not respond to tools/call.`);
    if (result.error) throw new Error(result.error.message || `MCP tools/call failed on ${serverId}.`);
    return result.result;
  }

  async listTools(serverId: string): Promise<{ name: string; description?: string }[]> {
    const session = await this.getSession(serverId);
    const listId = sendMcpMessage(session.child, "tools/list", {});
    const result = await waitForMcpResponse(session.child, 10000, listId);
    if (!result) throw new Error(`MCP server ${serverId} did not respond to tools/list.`);
    if (result.error) throw new Error(result.error.message || `MCP tools/list failed on ${serverId}.`);
    const list =
      (result.result as { tools?: { name: string; description?: string }[] } | undefined)?.tools ?? [];
    return list;
  }

  stopAll(): void {
    for (const session of this.sessions.values()) {
      stopMcpServer(session.child);
    }
    this.sessions.clear();
  }

  private async getSession(
    serverId: string,
  ): Promise<{ child: import("node:child_process").ChildProcessWithoutNullStreams; stderrBuf: string }> {
    const existing = this.sessions.get(serverId);
    if (existing) return existing;

    const db = this.getDb();
    const server = getMcpServer(db, serverId, true);
    if (!server) throw new Error(`MCP server not found: ${serverId}`);
    if (!server.enabled) throw new Error(`MCP server is disabled: ${serverId}`);

    const missingEnv = Object.entries(server.env ?? {})
      .filter(([, value]) => !value)
      .map(([key]) => key);
    if (missingEnv.length > 0) {
      throw new Error(`Missing environment variables: ${missingEnv.join(", ")}`);
    }

    const session = await spawnMcpServer(server as ConnectorConfig);
    this.sessions.set(serverId, session);
    return session;
  }
}
