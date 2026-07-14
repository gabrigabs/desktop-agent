interface SeparatorProps {
  className?: string;
}

export function Separator({ className = "" }: SeparatorProps) {
  return <hr className={`helix-rule ${className}`} />;
}
