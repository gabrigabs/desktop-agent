import mermaid from "mermaid";

let mermaidInitialized = false;

export function initMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
    suppressErrorRendering: true,
  });
  mermaidInitialized = true;
}

export async function validateMermaid(
  code: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  initMermaid();
  try {
    await mermaid.parse(code);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function renderMermaid(id: string, code: string): Promise<string> {
  initMermaid();
  const { svg } = await mermaid.render(id, code);
  return svg;
}
