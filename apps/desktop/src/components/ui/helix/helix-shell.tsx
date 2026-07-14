import type { ReactNode } from "react";

interface HelixShellProps {
  children: ReactNode;
  className?: string;
}

export function HelixShell({ children, className = "" }: HelixShellProps) {
  return <div className={`h-full w-full overflow-hidden relative select-none ${className}`}>{children}</div>;
}
