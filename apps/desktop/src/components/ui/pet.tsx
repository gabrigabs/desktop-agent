import { useId } from "react";
import { useAgentStore } from "../../stores/agent";

type PetState = "connecting" | "error" | "thinking" | "success" | "idle";
type PetVariant = "full" | "dot" | "hero" | "compact";

interface PetProps {
  className?: string;
  size?: number;
  variant?: PetVariant;
  glow?: boolean;
}

const STATE_CONFIG: Record<PetState, { primary: string; secondary: string; glow: string; label: string }> = {
  connecting: {
    primary: "#35d6ff",
    secondary: "#b9f3ff",
    glow: "rgba(53, 214, 255, 0.28)",
    label: "Conectando",
  },
  error: {
    primary: "#ff5f7a",
    secondary: "#ffc0cb",
    glow: "rgba(255, 95, 122, 0.3)",
    label: "Erro",
  },
  thinking: {
    primary: "#f4c542",
    secondary: "#fff0a8",
    glow: "rgba(244, 197, 66, 0.3)",
    label: "Pensando",
  },
  success: {
    primary: "#52e6a7",
    secondary: "#c1f8df",
    glow: "rgba(82, 230, 167, 0.28)",
    label: "Concluído",
  },
  idle: {
    primary: "#b982ff",
    secondary: "#e9d2ff",
    glow: "rgba(185, 130, 255, 0.32)",
    label: "Pronto",
  },
};

function usePetState(): PetState {
  const connected = useAgentStore((state) => state.connected);
  const streaming = useAgentStore((state) => state.streaming);
  const error = useAgentStore((state) => state.error);
  const result = useAgentStore((state) => state.result);

  if (!connected) return "connecting";
  if (error) return "error";
  if (streaming) return "thinking";
  if (result) return "success";
  return "idle";
}

export function Pet({ className = "", size = 64, variant = "full", glow = true }: PetProps) {
  const state = usePetState();
  const config = STATE_CONFIG[state];
  const gradientId = useId().replace(/:/g, "");
  const primaryGradientId = `${gradientId}-primary`;
  const secondaryGradientId = `${gradientId}-secondary`;
  const detailed = variant === "full" || variant === "hero";
  const hero = variant === "hero";
  const dot = variant === "dot";
  const ribbonWidth = dot ? 8 : hero ? 5.2 : detailed ? 5.8 : 7;

  return (
    <div
      className={`helix-seed helix-seed-${variant} relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size, ["--seed-glow" as string]: config.glow }}
      data-state={state}
      role="img"
      aria-label={config.label}
      title={config.label}
    >
      {glow && !dot && <span className="helix-seed-glow absolute inset-[8%] pointer-events-none" />}

      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={primaryGradientId} x1="20" y1="14" x2="78" y2="86">
            <stop offset="0" stopColor={config.secondary} />
            <stop offset="0.42" stopColor={config.primary} />
            <stop offset="1" stopColor={config.primary} stopOpacity="0.42" />
          </linearGradient>
          <linearGradient id={secondaryGradientId} x1="80" y1="16" x2="22" y2="84">
            <stop offset="0" stopColor={config.primary} stopOpacity="0.38" />
            <stop offset="0.58" stopColor={config.primary} />
            <stop offset="1" stopColor={config.secondary} />
          </linearGradient>
        </defs>

        {detailed && (
          <g className="helix-seed-orbits">
            <ellipse
              cx="50"
              cy="50"
              rx="45"
              ry="27"
              transform="rotate(-24 50 50)"
              stroke={config.primary}
              strokeWidth="0.9"
              strokeOpacity="0.28"
              strokeDasharray="18 9 3 12"
            />
            <ellipse
              cx="50"
              cy="50"
              rx="42"
              ry="24"
              transform="rotate(32 50 50)"
              stroke={config.secondary}
              strokeWidth="0.7"
              strokeOpacity="0.2"
              strokeDasharray="4 13"
            />
          </g>
        )}

        <g className="helix-seed-ribbons">
          <path
            className="helix-seed-ribbon helix-seed-ribbon-a"
            d="M31 17 C72 20 74 39 52 49 C29 60 29 79 69 83"
            stroke={`url(#${primaryGradientId})`}
            strokeWidth={ribbonWidth}
            strokeLinecap="round"
          />
          <path
            className="helix-seed-ribbon helix-seed-ribbon-b"
            d="M69 17 C28 20 26 39 48 49 C71 60 71 79 31 83"
            stroke={`url(#${secondaryGradientId})`}
            strokeWidth={ribbonWidth}
            strokeLinecap="round"
          />
        </g>

        <path
          className="helix-seed-void"
          d="M50 39 L61 50 L50 61 L39 50 Z"
          fill="#090810"
          stroke={config.secondary}
          strokeWidth={dot ? 2.2 : 1.4}
          strokeOpacity="0.78"
        />
        <path
          d="M50 44 L56 50 L50 56 L44 50 Z"
          fill={config.primary}
          fillOpacity="0.18"
          stroke={config.primary}
          strokeWidth="0.8"
          strokeOpacity="0.7"
        />

        {detailed && (
          <g className="helix-seed-satellites" fill={config.secondary}>
            <circle cx="12" cy="38" r={hero ? 1.6 : 1.3} opacity="0.78" />
            <circle cx="84" cy="25" r={hero ? 1.25 : 1} opacity="0.56" />
            <circle cx="82" cy="78" r={hero ? 1.8 : 1.35} opacity="0.72" />
          </g>
        )}

        {state === "success" && (
          <path
            className="helix-seed-success"
            d="M76 15 L77.5 19 L82 20.5 L77.5 22 L76 26 L74.5 22 L70 20.5 L74.5 19 Z"
            fill={config.secondary}
          />
        )}
      </svg>
    </div>
  );
}
