import { RPCChannel } from "kkrpc";
import { nodeStdioTransport } from "kkrpc/stdio";
import { agentApi } from "./api";

function main() {
  const transport = nodeStdioTransport();
  const channel = new RPCChannel(transport, { expose: agentApi });

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
