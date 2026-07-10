import { describe, expect, test } from "bun:test";
import { expandMcpArgs, getHighestPermissionLevel } from "../../packages/agent-runtime/src/mcp-tools";

describe("MCP permission policy", () => {
  test("does not let local read hide a write permission", () => {
    expect(getHighestPermissionLevel(["local.read", "local.write"])).toBe("local.write");
  });

  test("keeps browser control above network access", () => {
    expect(getHighestPermissionLevel(["browser.control", "network"])).toBe("browser.control");
  });

  test("defaults unknown empty policies to external approval", () => {
    expect(getHighestPermissionLevel([])).toBe("external");
  });

  test("expands environment paths without invoking a shell", () => {
    expect(
      expandMcpArgs(["$HOME/Desktop", "${DATA_DIR}/agent.db", "$MISSING/file"], {
        HOME: "/Users/test",
        DATA_DIR: "/tmp/data",
      }),
    ).toEqual(["/Users/test/Desktop", "/tmp/data/agent.db", "$MISSING/file"]);
  });
});
