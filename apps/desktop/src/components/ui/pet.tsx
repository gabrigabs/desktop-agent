import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useAgentStore } from "../../stores/agent";
import { HelixMark, type HelixMarkState } from "./helix-mark";

type PetState = HelixMarkState;
type PetVariant = "full" | "dot" | "hero" | "compact";

interface PetProps {
  className?: string;
  size?: number;
  variant?: PetVariant;
  glow?: boolean;
}

const STATE_CONFIG: Record<PetState, { primary: string; secondary: string; glow: string }> = {
  connecting: {
    primary: "#35d6ff",
    secondary: "#b9f3ff",
    glow: "rgba(53, 214, 255, 0.28)",
  },
  error: {
    primary: "#ff5f7a",
    secondary: "#ffc0cb",
    glow: "rgba(255, 95, 122, 0.3)",
  },
  thinking: {
    primary: "#f4c542",
    secondary: "#fff0a8",
    glow: "rgba(244, 197, 66, 0.3)",
  },
  using_tool: {
    primary: "#35d6ff",
    secondary: "#c4f6ff",
    glow: "rgba(53, 214, 255, 0.26)",
  },
  waiting_approval: {
    primary: "#f0a040",
    secondary: "#ffe0ad",
    glow: "rgba(240, 160, 64, 0.28)",
  },
  success: {
    primary: "#52e6a7",
    secondary: "#c1f8df",
    glow: "rgba(82, 230, 167, 0.28)",
  },
  idle: {
    primary: "#b982ff",
    secondary: "#e9d2ff",
    glow: "rgba(185, 130, 255, 0.32)",
  },
};

function usePetStateLabel(state: PetState): string {
  const { t } = useTranslation("common");
  return t(`common:petState.${state}`);
}

function usePetState(): PetState {
  const connected = useAgentStore((state) => state.connected);
  const streaming = useAgentStore((state) => state.streaming);
  const error = useAgentStore((state) => state.error);
  const result = useAgentStore((state) => state.result);
  const workflowRun = useAgentStore((state) => state.workflowRun);
  const latestLog = useAgentStore((state) => state.agentLogs[state.agentLogs.length - 1]);

  if (!connected) return "connecting";
  if (error) return "error";
  if (workflowRun?.status === "waiting_approval") return "waiting_approval";
  if (streaming && latestLog?.type === "tool_start") return "using_tool";
  if (streaming) return "thinking";
  if (result) return "success";
  return "idle";
}

export function Pet({ className = "", size = 64, variant = "full", glow = true }: PetProps) {
  const state = usePetState();
  const config = STATE_CONFIG[state];
  const label = usePetStateLabel(state);
  const orbitId = useId().replace(/:/g, "");
  const detailed = variant === "full" || variant === "hero";
  const hero = variant === "hero";
  const dot = variant === "dot";
  const markSize = dot ? size * 0.82 : hero ? size * 0.72 : detailed ? size * 0.84 : size * 0.88;

  const followUpSession = useAgentStore((s) => s.activeFollowUpSession);
  const followUpColor =
    followUpSession?.status === "active"
      ? "#35d6ff"
      : followUpSession?.status === "paused"
        ? "#f0a040"
        : followUpSession?.status === "waiting_approval"
          ? "#ff5f7a"
          : null;

  return (
    <div
      className={`helix-seed helix-seed-${variant} relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size, ["--seed-glow" as string]: config.glow }}
      data-state={state}
      role="img"
      aria-label={label}
      title={label}
    >
      {glow && !dot && <span className="helix-seed-glow absolute inset-[8%] pointer-events-none" />}

      {followUpColor && !dot && (
        <span
          className="absolute rounded-full pointer-events-none motion-safe:animate-[helix-orbit-pulse_2s_ease-in-out_infinite]"
          style={{
            inset: -3,
            border: `1.5px solid ${followUpColor}`,
            opacity: 0.5,
          }}
        />
      )}

      {detailed && (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="helix-seed-orbits absolute inset-0 overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={orbitId} x1="14" y1="20" x2="86" y2="80">
              <stop offset="0" stopColor={config.secondary} stopOpacity="0.08" />
              <stop offset="0.46" stopColor={config.primary} stopOpacity="0.58" />
              <stop offset="1" stopColor={config.primary} stopOpacity="0.1" />
            </linearGradient>
            <radialGradient id={`${orbitId}-node`} cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor={config.secondary} />
              <stop offset="0.5" stopColor={config.primary} stopOpacity="0.9" />
              <stop offset="1" stopColor={config.primary} stopOpacity="0" />
            </radialGradient>
          </defs>
          <g className="helix-orbital-chamber">
            <ellipse
              className="helix-orbit-track helix-orbit-track-a"
              cx="50"
              cy="50"
              rx={hero ? 47 : 44}
              ry={hero ? 27 : 25}
              transform="rotate(-24 50 50)"
              stroke={`url(#${orbitId})`}
              strokeWidth={hero ? 0.9 : 1.8}
              strokeDasharray="7 15 30 22"
            />
            <ellipse
              className="helix-orbit-sweep helix-orbit-sweep-a"
              cx="50"
              cy="50"
              rx={hero ? 47 : 44}
              ry={hero ? 27 : 25}
              transform="rotate(-24 50 50)"
              stroke={config.primary}
              strokeWidth={hero ? 1.15 : 2.2}
              strokeDasharray="1 180"
              strokeLinecap="round"
            />
            <ellipse
              className="helix-orbit-track helix-orbit-track-b"
              cx="50"
              cy="50"
              rx={hero ? 40 : 38}
              ry={hero ? 36 : 34}
              transform="rotate(31 50 50)"
              stroke={`url(#${orbitId})`}
              strokeWidth={hero ? 0.7 : 1.45}
              strokeDasharray="2 10 18 24"
            />
            <ellipse
              className="helix-orbit-sweep helix-orbit-sweep-b"
              cx="50"
              cy="50"
              rx={hero ? 40 : 38}
              ry={hero ? 36 : 34}
              transform="rotate(31 50 50)"
              stroke={config.secondary}
              strokeWidth={hero ? 0.9 : 1.8}
              strokeDasharray="1 210"
              strokeLinecap="round"
            />
            <ellipse
              className="helix-orbit-track helix-orbit-track-c"
              cx="50"
              cy="50"
              rx={hero ? 31 : 30}
              ry={hero ? 46 : 43}
              transform="rotate(72 50 50)"
              stroke={config.secondary}
              strokeOpacity={hero ? 0.16 : 0.24}
              strokeWidth={hero ? 0.65 : 1.3}
              strokeDasharray="1 8"
            />
            <g transform="rotate(-24 50 50)">
              <circle
                className="helix-orbit-node helix-orbit-node-a"
                cx={hero ? 97 : 94}
                cy="50"
                r="2.8"
                fill={`url(#${orbitId}-node)`}
              />
            </g>
            <g transform="rotate(31 50 50)">
              <circle
                className="helix-orbit-node helix-orbit-node-b"
                cx="50"
                cy={hero ? 14 : 16}
                r="2.2"
                fill={`url(#${orbitId}-node)`}
              />
            </g>
          </g>
        </svg>
      )}

      <HelixMark
        className="relative z-10"
        size={markSize}
        state={state}
        primary={config.primary}
        secondary={config.secondary}
      />
    </div>
  );
}
