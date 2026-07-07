import { useId } from "react";
import { useAgentStore } from "../../stores/agent";

type PetState = "connecting" | "error" | "thinking" | "success" | "idle";

interface PetProps {
  className?: string;
  size?: number;
  variant?: "full" | "dot";
}

const STATE_CONFIG: Record<
  PetState,
  {
    core: string;
    rim: string;
    glow: string;
    label: string;
  }
> = {
  connecting: {
    core: "#f0a040",
    rim: "#f7d6a0",
    glow: "rgba(240, 160, 64, 0.22)",
    label: "Conectando",
  },
  error: {
    core: "#f0607c",
    rim: "#f7a7b8",
    glow: "rgba(240, 96, 124, 0.24)",
    label: "Erro",
  },
  thinking: {
    core: "#f0c840",
    rim: "#f8e9a6",
    glow: "rgba(240, 200, 64, 0.26)",
    label: "Pensando",
  },
  success: {
    core: "#5fd0a0",
    rim: "#b8f0d8",
    glow: "rgba(95, 208, 160, 0.24)",
    label: "Concluído",
  },
  idle: {
    core: "#c499f4",
    rim: "#e2d3ff",
    glow: "rgba(196, 153, 244, 0.24)",
    label: "Pronto",
  },
};

function usePetState(): PetState {
  const connected = useAgentStore((s) => s.connected);
  const streaming = useAgentStore((s) => s.streaming);
  const error = useAgentStore((s) => s.error);
  const result = useAgentStore((s) => s.result);

  if (!connected) return "connecting";
  if (error) return "error";
  if (streaming) return "thinking";
  if (result) return "success";
  return "idle";
}

export function Pet({ className = "", size = 64, variant = "full" }: PetProps) {
  const state = usePetState();
  const config = STATE_CONFIG[state];

  if (variant === "dot") {
    return <PetDot size={size} state={state} config={config} className={className} />;
  }

  return <PetFull size={size} state={state} config={config} className={className} />;
}

function PetDot({
  size,
  state,
  config,
  className,
}: {
  size: number;
  state: PetState;
  config: (typeof STATE_CONFIG)[PetState];
  className: string;
}) {
  const isActive = state === "thinking" || state === "connecting";
  const animationClass = isActive ? "animate-pulse-fast" : "";

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      role="img"
      title={config.label}
      aria-label={config.label}
    >
      <div
        className={`rounded-full ${animationClass}`}
        style={{
          width: size,
          height: size,
          background: config.core,
          opacity: 0.85,
        }}
      />
    </div>
  );
}

function PetFull({
  size,
  state,
  config,
  className,
}: {
  size: number;
  state: PetState;
  config: (typeof STATE_CONFIG)[PetState];
  className: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const coreGradientId = `${gradientId}-core`;
  const ringGradientId = `${gradientId}-ring`;
  const isActive = state === "thinking" || state === "connecting";
  const coreAnimation = isActive ? "animate-pulse-fast" : state === "idle" ? "animate-pulse-gentle" : "";

  const spirals = [
    { r: 44, opacity: 0.18, speed: "7s" },
    { r: 36, opacity: 0.25, speed: "9s" },
    { r: 28, opacity: 0.32, speed: "11s" },
  ];

  return (
    <div
      className={`pet-companion relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${config.glow} 0%, transparent 60%)`,
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
        role="img"
        aria-label={config.label}
      >
        <title>{config.label}</title>
        <defs>
          <radialGradient id={coreGradientId} cx="38%" cy="35%" r="52%">
            <stop offset="0%" stopColor={config.rim} stopOpacity="1" />
            <stop offset="45%" stopColor={config.core} stopOpacity="1" />
            <stop offset="100%" stopColor={config.core} stopOpacity="1" />
          </radialGradient>
          <linearGradient id={ringGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.rim} stopOpacity="0.5" />
            <stop offset="100%" stopColor={config.core} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {spirals.map((s, i) => {
          const circumference = 2 * Math.PI * s.r;
          const dash = circumference * 0.6;
          const gap = circumference * 0.4;
          return (
            <circle
              key={s.r}
              cx="50"
              cy="50"
              r={s.r}
              fill="none"
              stroke={config.core}
              strokeOpacity={s.opacity}
              strokeWidth="0.8"
              className="pet-spiral-ring"
              style={{
                strokeDasharray: `${dash} ${gap}`,
                ["--circ" as string]: `${-circumference}`,
                animationDuration: s.speed,
                animationDelay: `${i * 0.25}s`,
              }}
            />
          );
        })}

        <circle cx="50" cy="50" r="19.5" fill="none" stroke={`url(#${ringGradientId})`} strokeWidth="2" />
        <circle
          cx="50"
          cy="50"
          r="17"
          fill="none"
          stroke={config.core}
          strokeWidth="1"
          strokeOpacity="0.4"
          className="pet-shockwave"
        />
        <circle className={coreAnimation} cx="50" cy="50" r="17" fill={`url(#${coreGradientId})`} />
        <circle
          cx="50"
          cy="50"
          r="10"
          fill="none"
          stroke={config.rim}
          strokeOpacity="0.3"
          strokeWidth="0.8"
          className="pet-inner-ring"
        />
      </svg>
    </div>
  );
}
