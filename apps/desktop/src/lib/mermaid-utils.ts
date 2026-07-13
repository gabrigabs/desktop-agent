const UNSAFE_SVG_PATTERN = /<\/?(?:script|foreignObject)\b|\bon[a-z]+\s*=|javascript\s*:/i;

export function sanitizeMermaidSvg(svg: string): string | null {
  const normalized = svg.trim();
  if (!normalized || UNSAFE_SVG_PATTERN.test(normalized)) return null;
  return normalized;
}

export function svgToDataUrl(svg: string): string | null {
  const safeSvg = sanitizeMermaidSvg(svg);
  return safeSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(safeSvg)}` : null;
}
