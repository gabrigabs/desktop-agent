import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "signal";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-white/5 text-faint border-line",
  success: "bg-good/10 text-good border-good/20",
  warning: "bg-warn/10 text-warn border-warn/20",
  error: "bg-bad/10 text-bad border-bad/20",
  signal: "bg-signal/10 text-signal border-signal/20",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
