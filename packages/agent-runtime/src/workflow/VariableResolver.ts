import type { WorkflowStep } from "@desktop-agent/shared";

export function resolveVariables<T>(value: T, context: WorkflowContext): T {
  if (typeof value === "string") {
    return resolveString(value, context) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveVariables(item, context)) as unknown as T;
  }

  if (value !== null && typeof value === "object") {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveVariables(val, context);
    }
    return resolved as unknown as T;
  }

  return value;
}

export interface WorkflowContext {
  prompt: string;
  clipboard: string;
  history: { role: "user" | "assistant" | "system"; content: string }[];
  steps: WorkflowStep[];
  run: { mode: string; providerId: string; model: string; maxSteps: number };
  metadata?: Record<string, unknown>;
}

function resolveString(value: string, context: WorkflowContext): string {
  return value
    .replace(/\{\{\s*\$prompt\s*\}\}/g, context.prompt)
    .replace(/\{\{\s*\$clipboard\s*\}\}/g, context.clipboard)
    .replace(/\{\{\s*\$history\s*\}\}/g, formatHistory(context.history))
    .replace(/\{\{\s*\$model\s*\}\}/g, context.run.model)
    .replace(/\{\{\s*\$providerId\s*\}\}/g, context.run.providerId)
    .replace(/\{\{\s*\$maxSteps\s*\}\}/g, String(context.run.maxSteps))
    .replace(/\{\{\s*step\[(\d+)\]\.output\s*\}\}/g, (_match, index) => {
      const step = context.steps[Number.parseInt(index, 10) - 1];
      if (!step) return "";
      const output = step.output;
      if (typeof output === "string") return output;
      try {
        return JSON.stringify(output ?? "");
      } catch {
        return "";
      }
    });
}

function formatHistory(history: { role: string; content: string }[]): string {
  return history.map((h) => `${h.role === "user" ? "Usuário" : "Assistente"}: ${h.content}`).join("\n\n");
}
