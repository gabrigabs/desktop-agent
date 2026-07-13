import type { AgentEvent, AppSettings, PermissionLevel } from "./types/rpc";

export type NativePermissionKind = "screen_recording" | "accessibility" | "notifications";

export type NativePermissionState = "granted" | "denied" | "not_determined" | "restricted" | "unavailable";

export type VisionFeature = "text" | "classification" | "barcode" | "saliency";

export type NativeBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisionTextObservation = {
  text: string;
  confidence: number;
  boundingBox?: NativeBoundingBox;
};

export type VisionClassification = {
  identifier: string;
  confidence: number;
};

export type VisionBarcode = {
  payload?: string;
  symbology: string;
  confidence: number;
  boundingBox?: NativeBoundingBox;
};

export type VisionAnalysis = {
  processedOnDevice: true;
  features: VisionFeature[];
  text?: {
    content: string;
    observations: VisionTextObservation[];
    truncated: boolean;
  };
  classifications?: VisionClassification[];
  barcodes?: VisionBarcode[];
  saliency?: { boundingBoxes: NativeBoundingBox[] };
  source: { kind: "file" | "capture"; displayName: string };
  durationMs: number;
};

export type NativeCapturePreview = {
  captureId: string;
  displayId: number;
  width: number;
  height: number;
  previewDataUrl: string;
  expiresAt: string;
};

export type NativeCaptureTarget = "display" | "active_window";

export type NativeCaptureRequest = {
  displayId?: number;
  excludeHelix?: boolean;
  captureTarget?: NativeCaptureTarget;
};

export type NativeCroppedPreview = {
  previewDataUrl: string;
  width: number;
  height: number;
};

export type NativeCaptureAnalysisRequest = {
  captureId: string;
  features: VisionFeature[];
  crop?: NativeBoundingBox;
  displayName?: string;
};

export type ActiveWindowElement = {
  role: string;
  label?: string;
  value?: string;
  text?: string;
  frame?: NativeBoundingBox;
};

export type ActiveWindowSnapshot = {
  appName: string;
  bundleId: string;
  pid: number;
  windowTitle: string;
  content: string;
  elements: ActiveWindowElement[];
  nodeCount: number;
  truncated: boolean;
  redactedCount: number;
  capturedAt: string;
};

export type NativeSystemContext = {
  osVersion: string;
  architecture: string;
  locale: string;
  timezone: string;
  displays: Array<{ id: number; width: number; height: number; scaleFactor: number }>;
};

export type NativeErrorCode =
  | "PERMISSION_DENIED"
  | "CAPTURE_CANCELLED"
  | "CAPTURE_EXPIRED"
  | "INVALID_RESOURCE"
  | "VISION_FAILED"
  | "ACCESSIBILITY_TIMEOUT"
  | "BRIDGE_UNAVAILABLE"
  | "NOTIFICATION_DENIED";

export type NativeError = {
  code: NativeErrorCode;
  message: string;
  recoverable: boolean;
};

export function normalizeNativeError(error: unknown): NativeError {
  if (error && typeof error === "object") {
    const value = error as Partial<NativeError> & { message?: unknown };
    if (typeof value.code === "string" && typeof value.message === "string") {
      const knownCodes: NativeErrorCode[] = [
        "PERMISSION_DENIED",
        "CAPTURE_CANCELLED",
        "CAPTURE_EXPIRED",
        "INVALID_RESOURCE",
        "VISION_FAILED",
        "ACCESSIBILITY_TIMEOUT",
        "BRIDGE_UNAVAILABLE",
        "NOTIFICATION_DENIED",
      ];
      const code = knownCodes.includes(value.code as NativeErrorCode)
        ? (value.code as NativeErrorCode)
        : "BRIDGE_UNAVAILABLE";
      return { code, message: value.message, recoverable: value.recoverable !== false };
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  const separator = message.indexOf(":");
  const candidate = separator > 0 ? message.slice(0, separator) : "";
  const known = [
    "PERMISSION_DENIED",
    "CAPTURE_CANCELLED",
    "CAPTURE_EXPIRED",
    "INVALID_RESOURCE",
    "VISION_FAILED",
    "ACCESSIBILITY_TIMEOUT",
    "BRIDGE_UNAVAILABLE",
    "NOTIFICATION_DENIED",
  ] as const;
  const code = (known as readonly string[]).includes(candidate) ? candidate : "BRIDGE_UNAVAILABLE";
  return {
    code: code as NativeErrorCode,
    message: separator > 0 ? message.slice(separator + 1).trim() : message,
    recoverable: code !== "PERMISSION_DENIED" && code !== "NOTIFICATION_DENIED",
  };
}

type ContextAttachmentBase = {
  id: string;
  label: string;
  preview: string;
  content?: string;
  metadata?: Record<string, unknown>;
  sensitive: boolean;
  enabled: boolean;
  imageDataUrl?: string;
};

export type ContextAttachment =
  | (ContextAttachmentBase & { source: "clipboard"; policy: "include" })
  | (ContextAttachmentBase & { source: "file"; policy: "include" | "reference" | "summary" })
  | (ContextAttachmentBase & { source: "screen"; policy: "include" })
  | (ContextAttachmentBase & { source: "active_app"; policy: "include" })
  | (ContextAttachmentBase & { source: "connector"; policy: "reference" });

export type NativeNotificationInput = {
  kind: "completed" | "failed" | "approval";
  title?: string;
  body?: string;
  includePreview?: boolean;
};

export type HostBridgeApi = {
  onEvent(event: AgentEvent): Promise<void>;
  validateMermaid(input: { code: string }): Promise<{ valid: true } | { valid: false; error: string }>;
  getNativePermissionState(input: { kind: NativePermissionKind }): Promise<NativePermissionState>;
  requestNativePermission(input: { kind: NativePermissionKind }): Promise<NativePermissionState>;
  analyzeNativeImage(input: {
    path: string;
    features: VisionFeature[];
    displayName?: string;
  }): Promise<VisionAnalysis>;
  prepareNativeCapture(input?: NativeCaptureRequest): Promise<NativeCapturePreview>;
  cropNativeCapture(input: { captureId: string; crop: NativeBoundingBox }): Promise<NativeCroppedPreview>;
  analyzeNativeCapture(input: NativeCaptureAnalysisRequest): Promise<VisionAnalysis>;
  discardNativeCapture(input: { captureId: string }): Promise<void>;
  snapshotActiveWindow(): Promise<ActiveWindowSnapshot>;
  getNativeSystemContext(): Promise<NativeSystemContext>;
  sendNativeNotification(input: NativeNotificationInput): Promise<void>;
};

export type ExecutionGrant = {
  stepId: string;
  toolName: string;
  permissionLevel: PermissionLevel;
  inputHash: string;
  expiresAt: number;
};

export type NativeSettings = Pick<AppSettings, "notificationsEnabled" | "notificationContentMode">;
