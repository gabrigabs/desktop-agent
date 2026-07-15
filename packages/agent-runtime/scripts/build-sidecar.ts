import { execSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";

const triple = execSync("rustc -vV")
  .toString()
  .split("\n")
  .find((l) => l.startsWith("host:"))
  ?.split("host:")[1]
  ?.trim();

if (!triple) {
  console.error("Could not determine target triple from rustc");
  process.exit(1);
}

const outfile = `../../apps/desktop/src-tauri/binaries/agent-runtime-${triple}`;

const result = Bun.spawnSync(["bun", "build", "./src/index.ts", "--compile", `--outfile=${outfile}`], {
  stdio: ["inherit", "inherit", "inherit"],
});

if (result.exitCode !== 0) {
  process.exit(result.exitCode);
}

const packageSuffix = triple.includes("apple-darwin")
  ? `darwin-${triple.startsWith("aarch64") ? "arm64" : "x64"}`
  : null;
if (packageSuffix) {
  const packageRoot = path.resolve(
    `../../node_modules/.bun/@llamaindex+liteparse-${packageSuffix}@2.5.1/node_modules/@llamaindex/liteparse-${packageSuffix}`,
  );
  const resourceRoot = path.resolve("../../apps/desktop/src-tauri/resources/liteparse");
  mkdirSync(resourceRoot, { recursive: true });
  cpSync(
    path.join(packageRoot, `liteparse.${packageSuffix}.node`),
    path.join(resourceRoot, `liteparse.${packageSuffix}.node`),
  );
  cpSync(path.join(packageRoot, "libpdfium.dylib"), path.join(resourceRoot, "libpdfium.dylib"));
}

console.log(`Sidecar built: ${outfile}`);
