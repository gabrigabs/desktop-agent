import { parseDocument } from "@desktop-agent/lite-parse";
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

const parseArgument = process.argv.indexOf("--parse-document");
if (parseArgument >= 0) {
  const filePath = process.argv[parseArgument + 1];
  if (!filePath) {
    process.stderr.write("Missing file path for --parse-document\n");
    process.exit(2);
  }
  parseDocument(filePath)
    .then((result) => {
      process.stdout.write(JSON.stringify(result));
    })
    .catch((error) => {
      process.stderr.write(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
} else {
  main();
}
