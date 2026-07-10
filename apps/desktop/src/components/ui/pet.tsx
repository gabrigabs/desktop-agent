import { useId } from "react";
import { useAgentStore } from "../../stores/agent";

type PetState = "connecting" | "error" | "thinking" | "success" | "idle";

interface PetProps {
  className?: string;
  size?: number;
  variant?: "full" | "dot" | "hero" | "compact";
  glow?: boolean;
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
    glow: "rgba(240, 160, 64, 0.32)",
    label: "Conectando",
  },
  error: {
    core: "#f0607c",
    rim: "#f7a7b8",
    glow: "rgba(240, 96, 124, 0.34)",
    label: "Erro",
  },
  thinking: {
    core: "#f0c840",
    rim: "#f8e9a6",
    glow: "rgba(240, 200, 64, 0.36)",
    label: "Pensando",
  },
  success: {
    core: "#5fd0a0",
    rim: "#b8f0d8",
    glow: "rgba(95, 208, 160, 0.34)",
    label: "Concluído",
  },
  idle: {
    core: "#c084fc",
    rim: "#f5e6ff",
    glow: "rgba(196, 153, 244, 0.45)",
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

export function Pet({ className = "", size = 64, variant = "full", glow = true }: PetProps) {
  const state = usePetState();
  const config = STATE_CONFIG[state];

  if (variant === "dot") {
    return <PetDot size={size} state={state} config={config} className={className} />;
  }

  if (variant === "compact") {
    return <PetCompact size={size} state={state} config={config} className={className} glow={glow} />;
  }

  if (variant === "hero") {
    return <PetHero size={size} state={state} config={config} className={className} glow={glow} />;
  }

  return <PetFull size={size} state={state} config={config} className={className} glow={glow} />;
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

function PetCompact({
  size,
  state,
  config,
  className,
  glow = true,
}: {
  size: number;
  state: PetState;
  config: (typeof STATE_CONFIG)[PetState];
  className: string;
  glow?: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const coreGradientId = `${gradientId}-core`;
  const ringGradientId = `${gradientId}-ring`;
  const isActive = state === "thinking" || state === "connecting";
  const coreAnimation = isActive ? "animate-pulse-fast" : state === "idle" ? "animate-pulse-gentle" : "";

  return (
    <div
      className={`pet-compact relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={config.label}
      title={config.label}
    >
      {glow && (
        <div
          className="absolute inset-[-12%] rounded-full pointer-events-none animate-pulse-soft"
          style={{
            background: `radial-gradient(circle, ${config.glow} 0%, transparent 55%)`,
            filter: "blur(4px)",
            opacity: 0.85,
          }}
        />
      )}

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
          <radialGradient id={coreGradientId} cx="35%" cy="30%" r="60%">
            <stop offset="0%" stopColor={config.rim} stopOpacity="1" />
            <stop offset="40%" stopColor={config.core} stopOpacity="1" />
            <stop offset="85%" stopColor={config.core} stopOpacity="1" />
            <stop offset="100%" stopColor={config.core} stopOpacity="1" />
          </radialGradient>
          <linearGradient id={ringGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.rim} stopOpacity="0.9" />
            <stop offset="50%" stopColor={config.core} stopOpacity="0.5" />
            <stop offset="100%" stopColor={config.core} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Outer orbital rings */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="url(#ringGradientId)"
          strokeWidth="1.8"
          strokeOpacity="0.45"
          className="pet-compact-orbit"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={config.rim}
          strokeWidth="1"
          strokeOpacity="0.28"
          strokeDasharray="6 10"
          className="pet-compact-orbit"
          style={{ animationDirection: "reverse" }}
        />
        <circle
          cx="50"
          cy="50"
          r="34"
          fill="none"
          stroke={config.core}
          strokeWidth="0.8"
          strokeOpacity="0.22"
          strokeDasharray="4 8"
          className="pet-compact-orbit"
        />

        {/* Main outer ring */}
        <circle cx="50" cy="50" r="22" fill="none" stroke={`url(#${ringGradientId})`} strokeWidth="2.4" />

        {/* Core */}
        <circle className={coreAnimation} cx="50" cy="50" r="18" fill={`url(#${coreGradientId})`} />
      </svg>
    </div>
  );
}

function PetFull({
  size,
  state,
  config,
  className,
  glow = true,
}: {
  size: number;
  state: PetState;
  config: (typeof STATE_CONFIG)[PetState];
  className: string;
  glow?: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const coreGradientId = `${gradientId}-core`;
  const ringGradientId = `${gradientId}-ring`;
  const isActive = state === "thinking" || state === "connecting";
  const coreAnimation = isActive ? "animate-pulse-fast" : state === "idle" ? "animate-pulse-gentle" : "";
  const orbitSpeed = state === "connecting" ? "4s" : state === "thinking" ? "5s" : "8s";

  const spirals = [
    { r: 46, opacity: 0.35, speed: "14s", width: 1.2, dir: 1 },
    { r: 38, opacity: 0.45, speed: "18s", width: 1, dir: -1 },
    { r: 30, opacity: 0.55, speed: "11s", width: 1, dir: 1 },
  ];

  const particles = [
    { r: 42, size: 1.4, delay: "0s", duration: "6s" },
    { r: 34, size: 1, delay: "2s", duration: "8s" },
    { r: 50, size: 1.2, delay: "4s", duration: "10s" },
  ];

  return (
    <div
      className={`pet-companion relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          className="absolute inset-[-8%] rounded-full pointer-events-none animate-pulse-soft"
          style={{
            background: `radial-gradient(circle, ${config.glow} 0%, transparent 55%)`,
            filter: "blur(5px)",
            opacity: 0.85,
          }}
        />
      )}

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
          <radialGradient id={coreGradientId} cx="35%" cy="30%" r="60%">
            <stop offset="0%" stopColor={config.rim} stopOpacity="1" />
            <stop offset="40%" stopColor={config.core} stopOpacity="1" />
            <stop offset="85%" stopColor={config.core} stopOpacity="1" />
            <stop offset="100%" stopColor={config.core} stopOpacity="1" />
          </radialGradient>
          <linearGradient id={ringGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.rim} stopOpacity="0.9" />
            <stop offset="50%" stopColor={config.core} stopOpacity="0.5" />
            <stop offset="100%" stopColor={config.core} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Orbiting particles */}
        <g className="pet-particle" style={{ animationDuration: orbitSpeed }}>
          {particles.map((p, i) => (
            <circle
              key={`orbit-${p.r}`}
              cx="50"
              cy="50"
              r={p.r}
              fill="none"
              stroke="transparent"
              className={i % 2 === 1 ? "pet-particle-alt" : ""}
              style={{ animationDuration: p.duration }}
            />
          ))}
        </g>

        {particles.map((p, i) => {
          const angle = i * 120 * (Math.PI / 180);
          return (
            <circle
              key={`particle-${p.r}-${p.delay}`}
              cx={50 + p.r * Math.cos(angle)}
              cy={50 + p.r * Math.sin(angle)}
              r={p.size}
              fill={config.rim}
              fillOpacity={0.85 - i * 0.12}
              className={i % 2 === 1 ? "pet-particle-alt" : "pet-particle"}
              style={{ animationDuration: p.duration, animationDelay: p.delay }}
            />
          );
        })}

        {/* Spiral rings */}
        {spirals.map((s, i) => {
          const circumference = 2 * Math.PI * s.r;
          const dash = circumference * 0.55;
          const gap = circumference * 0.45;
          return (
            <circle
              key={s.r}
              cx="50"
              cy="50"
              r={s.r}
              fill="none"
              stroke={config.core}
              strokeOpacity={s.opacity}
              strokeWidth={s.width}
              className="pet-spiral-ring"
              style={{
                strokeDasharray: `${dash} ${gap}`,
                ["--circ" as string]: `${-circumference * s.dir}`,
                animationDuration: s.speed,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          );
        })}

        {/* Main outer ring */}
        <circle cx="50" cy="50" r="20.5" fill="none" stroke={`url(#${ringGradientId})`} strokeWidth="2.4" />

        {/* Shockwave ring */}
        <circle
          cx="50"
          cy="50"
          r="18"
          fill="none"
          stroke={config.core}
          strokeWidth="1"
          strokeOpacity="0.45"
          className="pet-shockwave"
        />

        {/* Planet core */}
        <circle className={coreAnimation} cx="50" cy="50" r="17" fill={`url(#${coreGradientId})`} />
      </svg>
    </div>
  );
}

function PetHero({
  size,
  state,
  config,
  className,
  glow = true,
}: {
  size: number;
  state: PetState;
  config: (typeof STATE_CONFIG)[PetState];
  className: string;
  glow?: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const coreGradientId = `${gradientId}-core`;
  const ringGradientId = `${gradientId}-ring`;
  const isActive = state === "thinking" || state === "connecting";
  const coreAnimation = isActive ? "animate-pulse-fast" : state === "idle" ? "animate-pulse-gentle" : "";

  const spirals = [
    { r: 46, opacity: 0.35, speed: "14s", width: 1.2, dir: 1, offset: 0 },
    { r: 46, opacity: 0.28, speed: "17s", width: 1, dir: -1, offset: 180 },
    { r: 38, opacity: 0.45, speed: "18s", width: 1, dir: -1, offset: 0 },
    { r: 38, opacity: 0.38, speed: "21s", width: 0.9, dir: 1, offset: 180 },
    { r: 30, opacity: 0.55, speed: "11s", width: 1, dir: 1, offset: 0 },
    { r: 30, opacity: 0.42, speed: "13s", width: 0.9, dir: -1, offset: 180 },
  ];

  const particles = [
    { r: 52, size: 1.6, delay: "0s", duration: "5s" },
    { r: 44, size: 1.2, delay: "1.2s", duration: "7s" },
    { r: 36, size: 1, delay: "2.4s", duration: "9s" },
    { r: 58, size: 1.3, delay: "3.6s", duration: "11s" },
    { r: 28, size: 0.9, delay: "4.8s", duration: "13s" },
  ];

  return (
    <div
      className={`pet-companion pet-hero relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <>
          <div
            className="absolute inset-[-20%] rounded-full pointer-events-none animate-pulse-soft"
            style={{
              background: `radial-gradient(circle, ${config.glow} 0%, transparent 55%)`,
              filter: "blur(8px)",
              opacity: 0.9,
            }}
          />
          <div
            className="absolute inset-[-40%] rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${config.glow} 0%, transparent 50%)`,
              filter: "blur(18px)",
              opacity: 0.35,
            }}
          />
        </>
      )}

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
          <radialGradient id={coreGradientId} cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor={config.rim} stopOpacity="1" />
            <stop offset="40%" stopColor={config.core} stopOpacity="1" />
            <stop offset="85%" stopColor={config.core} stopOpacity="1" />
            <stop offset="100%" stopColor={config.core} stopOpacity="1" />
          </radialGradient>
          <linearGradient id={ringGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.rim} stopOpacity="0.9" />
            <stop offset="50%" stopColor={config.core} stopOpacity="0.5" />
            <stop offset="100%" stopColor={config.core} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Outer orbital rings */}
        <circle
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke="url(#ringGradientId)"
          strokeWidth="1.2"
          strokeOpacity="0.35"
          className="pet-hero-orbit"
        />
        <circle
          cx="50"
          cy="50"
          r="26"
          fill="none"
          stroke={config.rim}
          strokeWidth="0.6"
          strokeOpacity="0.18"
          strokeDasharray="4 10"
          className="pet-hero-outer-orbit"
        />

        {/* Orbiting particles */}
        {particles.map((p, i) => {
          const angle = i * 72 * (Math.PI / 180);
          return (
            <circle
              key={`particle-${p.r}-${p.delay}`}
              cx={50 + p.r * Math.cos(angle)}
              cy={50 + p.r * Math.sin(angle)}
              r={p.size}
              fill={config.rim}
              fillOpacity={0.85 - i * 0.08}
              className={i % 2 === 1 ? "pet-hero-particle-alt" : "pet-hero-particle"}
              style={{ animationDuration: p.duration, animationDelay: p.delay }}
            />
          );
        })}

        {/* Dual helix spiral rings */}
        {spirals.map((s, i) => {
          const circumference = 2 * Math.PI * s.r;
          const dash = circumference * 0.55;
          const gap = circumference * 0.45;
          return (
            <circle
              key={`spiral-${s.r}-${s.offset}-${s.dir}`}
              cx="50"
              cy="50"
              r={s.r}
              fill="none"
              stroke={config.core}
              strokeOpacity={s.opacity}
              strokeWidth={s.width}
              className="pet-hero-spiral"
              style={{
                strokeDasharray: `${dash} ${gap}`,
                ["--circ" as string]: `${-circumference * s.dir}`,
                animationDuration: s.speed,
                animationDelay: `${i * 0.25}s`,
                transform: `rotate(${s.offset}deg)`,
                transformOrigin: "center",
              }}
            />
          );
        })}

        {/* Main outer ring */}
        <circle cx="50" cy="50" r="20.5" fill="none" stroke={`url(#${ringGradientId})`} strokeWidth="2.4" />

        {/* Shockwave ring */}
        <circle
          cx="50"
          cy="50"
          r="18"
          fill="none"
          stroke={config.core}
          strokeWidth="1"
          strokeOpacity="0.45"
          className="pet-shockwave"
        />

        {/* Planet core */}
        <circle className={coreAnimation} cx="50" cy="50" r="17" fill={`url(#${coreGradientId})`} />
      </svg>
    </div>
  );
}
