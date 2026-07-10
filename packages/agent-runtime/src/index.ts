import { getDb, runMigrations } from "@desktop-agent/storage";
import { RPCChannel } from "kkrpc";
import { nodeStdioTransport } from "kkrpc/stdio";
import { agentApi, setClientApi } from "./api";

function main() {
  const db = getDb();
  runMigrations(db);

  const transport = nodeStdioTransport();
  const channel = new RPCChannel(transport, { expose: agentApi, timeout: 0 });

  setClientApi(channel.getAPI());

  process.on("SIGTERM", () => {
    agentApi.shutdown();
    channel.destroy();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    agentApi.shutdown();
    channel.destroy();
    process.exit(0);
  });
}

main();
