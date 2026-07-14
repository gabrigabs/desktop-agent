import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  className?: string;
}

export function Textarea({ invalid = false, className = "", ...rest }: TextareaProps) {
  return (
    <textarea
      className={`w-full bg-ink border rounded-lg px-3 py-2 text-xs text-fg outline-none select-text placeholder:text-faint transition-colors resize-none ${
        invalid ? "border-bad/50" : "border-line hover:border-line-strong focus:border-signal/40"
      } ${className}`}
      {...rest}
    />
  );
}
