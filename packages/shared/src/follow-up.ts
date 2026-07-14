export type FollowUpMode = "vision" | "debug" | "writing" | "research" | "workflow";
export type FollowUpStatus = "active" | "paused" | "waiting_approval" | "completed" | "failed";
export type FollowUpMemoryScope = "space" | "session" | "global";
export type FollowUpObservationSource = "manual" | "clipboard" | "file" | "screen" | "assistant";
export type FollowUpHypothesisStatus = "open" | "confirmed" | "refuted";
export type FollowUpEventType =
  | "started"
  | "paused"
  | "resumed"
  | "stopped"
  | "observation"
  | "hypothesis"
  | "approval"
  | "completed";

export type FollowUpContextPolicy = {
  screenCapture: boolean;
  clipboard: boolean;
  fileAccess: boolean;
};

export type FollowUpObservation = {
  id: string;
  sessionId: string;
  content: string;
  source: FollowUpObservationSource;
  timestamp: string;
};

export type FollowUpHypothesis = {
  id: string;
  sessionId: string;
  text: string;
  status: FollowUpHypothesisStatus;
  evidenceIds: string[];
  timestamp: string;
};

export type FollowUpEvent = {
  id: string;
  sessionId: string;
  type: FollowUpEventType;
  payload: unknown;
  timestamp: string;
};

export type FollowUpSession = {
  id: string;
  mode: FollowUpMode;
  status: FollowUpStatus;
  objective: string;
  spaceId: string | null;
  memoryScope: FollowUpMemoryScope;
  contextPolicy: FollowUpContextPolicy;
  observations: FollowUpObservation[];
  hypotheses: FollowUpHypothesis[];
  events: FollowUpEvent[];
  nextActions: string[];
  createdAt: string;
  updatedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  closeReason: string | null;
};
