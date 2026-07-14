import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  title: string;
  active?: boolean;
  className?: string;
}

export function IconButton({ children, title, active = false, className = "", ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
        active
          ? "text-signal bg-signal/10 border border-signal/30"
          : "text-faint hover:text-fg hover:bg-white/[0.05] border border-transparent"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
