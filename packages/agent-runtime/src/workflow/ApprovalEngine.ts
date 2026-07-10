import type { PermissionLevel } from "@desktop-agent/shared";

export type ApprovalThreshold = PermissionLevel | "none" | "all";

const SENSITIVITY_ORDER: ApprovalThreshold[] = [
  "none",
  "local.read",
  "local.write",
  "network",
  "browser.control",
  "screen.read",
  "external",
  "all",
];

function sensitivityIndex(level: PermissionLevel | "none" | "all"): number {
  const index = SENSITIVITY_ORDER.indexOf(level);
  return index === -1 ? SENSITIVITY_ORDER.indexOf("external") : index;
}

export function requiresApproval(
  level: PermissionLevel | undefined,
  threshold: ApprovalThreshold | undefined,
): boolean {
  if (!level || threshold === "none" || !threshold) return false;
  if (threshold === "all") return true;
  return sensitivityIndex(level) >= sensitivityIndex(threshold);
}
