import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  className?: string;
}

export function Input({ invalid = false, className = "", ...rest }: InputProps) {
  return (
    <input
      className={`w-full bg-ink border rounded-lg px-3 py-2 text-xs text-fg outline-none select-text placeholder:text-faint transition-colors ${
        invalid ? "border-bad/50" : "border-line hover:border-line-strong focus:border-signal/40"
      } ${className}`}
      {...rest}
    />
  );
}
