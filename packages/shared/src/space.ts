export type SpaceLayout = "chat" | "collections";

export type SpaceMemoryFact = {
  id: string;
  spaceId: string;
  content: string;
  origin: "manual" | "assistant";
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  sourceTurnId?: string;
};

export type SpaceFieldType = "text" | "number" | "currency" | "date" | "boolean" | "select";

export type SpaceField = {
  id: string;
  name: string;
  type: SpaceFieldType;
  required: boolean;
  options?: string[];
};

export type SpaceCollection = {
  id: string;
  spaceId: string;
  name: string;
  icon: string;
  fields: SpaceField[];
  createdAt: string;
  updatedAt: string;
};

export type SpaceRecordValue = string | number | boolean | null;

export type SpaceRecord = {
  id: string;
  spaceId: string;
  collectionId: string;
  values: Record<string, SpaceRecordValue>;
  createdAt: string;
  updatedAt: string;
};

export type SpaceViewType = "table" | "board" | "summary";

export type SpaceView = {
  id: string;
  spaceId: string;
  collectionId: string;
  name: string;
  type: SpaceViewType;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ExecutionContextSnapshot = {
  id: string;
  runId: string;
  spaceId: string | null;
  facts: { id: string; content: string }[];
  instructions: string;
  sources: { documentId: string; displayName: string }[];
  fileContextPaths: string[];
  createdAt: string;
};

export type Space = {
  id: string;
  name: string;
  icon: string;
  color: string;
  folderPath: string;
  purpose: string;
  instructions: string;
  profileId?: string;
  preferredLayout: SpaceLayout;
  memoryEnabled: boolean;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type SpaceDocument = {
  spaceId: string;
  documentId: string;
  addedAt: string;
};
