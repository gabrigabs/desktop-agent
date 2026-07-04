import { useAgentStore } from "../../stores/agent";

interface PetProps {
  className?: string;
  size?: number;
}

export function Pet({ className = "", size = 64 }: PetProps) {
  const { connected, streaming, error, result } = useAgentStore();

  // Determine state
  let state: "connecting" | "error" | "thinking" | "success" | "idle" = "idle";
  if (!connected) {
    state = "connecting";
  } else if (error) {
    state = "error";
  } else if (streaming) {
    state = "thinking";
  } else if (result) {
    state = "success";
  }

  // Dynamic colors and glow based on state
  const colors = {
    connecting: {
      core: "fill-amber-500 shadow-amber-500/50",
      rings: "stroke-amber-500/70",
      text: "text-amber-400",
      glow: "rgba(245, 158, 11, 0.4)",
    },
    error: {
      core: "fill-rose-500 shadow-rose-500/50",
      rings: "stroke-rose-500/75",
      text: "text-rose-400",
      glow: "rgba(244, 63, 94, 0.4)",
    },
    thinking: {
      core: "fill-yellow-400 shadow-yellow-400/50",
      rings: "stroke-yellow-400/85",
      text: "text-yellow-400",
      glow: "rgba(253, 224, 71, 0.5)",
    },
    success: {
      core: "fill-emerald-400 shadow-emerald-400/50",
      rings: "stroke-emerald-400/75",
      text: "text-emerald-400",
      glow: "rgba(52, 211, 153, 0.4)",
    },
    idle: {
      core: "fill-indigo-500 shadow-indigo-500/50",
      rings: "stroke-indigo-500/60",
      text: "text-indigo-400",
      glow: "rgba(99, 102, 241, 0.3)",
    },
  };

  const currentTheme = colors[state];

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Dynamic Glow Aura */}
      <div
        className="absolute inset-0 rounded-full blur-xl opacity-60 transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${currentTheme.glow} 0%, transparent 70%)`,
        }}
      />

      {/* SVG Kinetic Core */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 transition-transform duration-500 hover:scale-105"
        role="img"
      >
        <title>AI Kinetic Core</title>
        {/* Outer Orbit (Dotted/High-Tech) */}
        <circle
          cx="50"
          cy="50"
          r="42"
          className={`stroke-2 animate-spin-clockwise ${currentTheme.rings} transition-colors duration-500`}
          strokeDasharray="4 16"
          strokeLinecap="round"
        />

        {/* Inner Orbit (Solid with Gap) */}
        <circle
          cx="50"
          cy="50"
          r="30"
          className={`stroke-[1.5] animate-spin-counter ${currentTheme.rings} transition-colors duration-500`}
          strokeDasharray="120 40"
          strokeLinecap="round"
        />

        {/* Dynamic Particle Dots rotating in inner orbit */}
        <g className="animate-spin-clockwise" style={{ transformOrigin: "50% 50%" }}>
          <circle
            cx="50"
            cy="20"
            r="2"
            className={state === "thinking" ? "fill-yellow-300" : "fill-indigo-300/60"}
          />
          <circle
            cx="50"
            cy="80"
            r="1.5"
            className={state === "thinking" ? "fill-yellow-300/80" : "fill-indigo-300/40"}
          />
        </g>

        {/* Central Core (Pulsing Heart) */}
        <circle
          cx="50"
          cy="50"
          r={state === "thinking" ? 14 : 11}
          className={`transition-all duration-500 ${currentTheme.core} ${
            state === "thinking"
              ? "animate-pulse"
              : state === "connecting"
                ? "animate-pulse"
                : "animate-pulse-gentle"
          }`}
          style={{
            filter: `drop-shadow(0 0 8px ${currentTheme.glow})`,
          }}
        />
      </svg>
    </div>
  );
}
