import type { LabelHTMLAttributes } from "react";

export function Label({ htmlFor, className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-[11px] font-medium text-faint uppercase tracking-wide ${className ?? ""}`}
      {...props}
    >
      {children}
    </label>
  );
}
