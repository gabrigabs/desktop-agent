export function prepareMarkdown(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/\0/g, "");
}
