import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return <div className={`rounded-xl bg-white/[0.02] border border-line p-4 ${className}`}>{children}</div>;
}
