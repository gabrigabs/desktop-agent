export type ParsedDocument = {
  id: string;
  path: string;
  displayName: string;
  size: number;
  mimeType: string;
  encoding: "text" | "binary" | "unsupported" | "parsed";
  content?: string;
  preview: string;
  parsedFormat?: "pdf" | "csv" | "excel" | "markdown" | "docx" | "pptx" | "image";
  parsedMetadata?: import("./rpc").ParsedMetadata;
  status: "pending" | "parsing" | "done" | "error";
  error?: string;
  createdAt: string;
  updatedAt: string;
};
