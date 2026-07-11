import { useId } from "react";

export type HelixMarkState =
  | "connecting"
  | "error"
  | "thinking"
  | "using_tool"
  | "waiting_approval"
  | "success"
  | "idle";

interface HelixMarkProps {
  className?: string;
  size?: number;
  state?: HelixMarkState;
  primary?: string;
  secondary?: string;
  title?: string;
}

export function HelixMark({
  className = "",
  size = 32,
  state = "idle",
  primary = "#b982ff",
  secondary = "#ead8ff",
  title,
}: HelixMarkProps) {
  const id = useId().replace(/:/g, "");
  const ribbonA = `${id}-ribbon-a`;
  const ribbonB = `${id}-ribbon-b`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`helix-mark ${className}`}
      data-state={state}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={ribbonA} x1="22" y1="10" x2="78" y2="90">
          <stop offset="0" stopColor={secondary} />
          <stop offset="0.42" stopColor={primary} />
          <stop offset="1" stopColor={primary} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={ribbonB} x1="78" y1="10" x2="22" y2="90">
          <stop offset="0" stopColor={primary} stopOpacity="0.48" />
          <stop offset="0.58" stopColor={primary} />
          <stop offset="1" stopColor={secondary} />
        </linearGradient>
      </defs>

      <g className="helix-mark-ribbons">
        <path
          className="helix-mark-ribbon helix-mark-ribbon-a"
          d="M28 15 V33 C28 44 36 50 50 50 C64 50 72 57 72 68 V85"
          stroke={`url(#${ribbonA})`}
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          className="helix-mark-ribbon helix-mark-ribbon-b"
          d="M72 15 V33 C72 44 64 50 50 50 C36 50 28 57 28 68 V85"
          stroke={`url(#${ribbonB})`}
          strokeWidth="9"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
