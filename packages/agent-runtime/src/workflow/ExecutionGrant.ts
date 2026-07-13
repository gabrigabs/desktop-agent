import { createHash } from "node:crypto";
import type { ExecutionGrant, PermissionLevel } from "@desktop-agent/shared";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

export function hashToolInput(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(input)))
    .digest("hex");
}

export function createExecutionGrant(
  toolName: string,
  permissionLevel: PermissionLevel,
  input: unknown,
  stepId = "direct",
  ttlMs = 120_000,
): ExecutionGrant {
  return {
    stepId,
    toolName,
    permissionLevel,
    inputHash: hashToolInput(input),
    expiresAt: Date.now() + ttlMs,
  };
}

export function grantKey(grant: ExecutionGrant): string {
  return `${grant.stepId}:${grant.toolName}:${grant.permissionLevel}:${grant.inputHash}:${grant.expiresAt}`;
}
