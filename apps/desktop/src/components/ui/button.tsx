import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-signal text-ink hover:brightness-110 border-transparent",
  secondary: "bg-white/[0.04] text-fg border-line hover:bg-white/[0.08] hover:border-line-strong",
  ghost: "bg-transparent text-mute border-transparent hover:text-fg hover:bg-white/[0.04]",
  danger: "bg-bad/10 text-bad border-bad/20 hover:bg-bad/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[11px]",
  md: "h-9 px-4 text-xs",
  lg: "h-11 px-5 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
