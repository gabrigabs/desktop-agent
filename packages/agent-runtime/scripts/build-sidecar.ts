import { execSync } from "node:child_process";

const triple = execSync("rustc -vV").toString()
  .split("\n")
  .find((l) => l.startsWith("host:"))
  ?.split("host:")[1]
  ?.trim();

if (!triple) {
  console.error("Could not determine target triple from rustc");
  process.exit(1);
}

const outfile = `../../apps/desktop/src-tauri/binaries/agent-runtime-${triple}`;

const result = Bun.spawnSync([
  "bun",
  "build",
  "./src/index.ts",
  "--compile",
  `--outfile=${outfile}`,
], {
  stdio: ["inherit", "inherit", "inherit"],
});

if (result.exitCode !== 0) {
  process.exit(result.exitCode);
}

console.log(`Sidecar built: ${outfile}`);
