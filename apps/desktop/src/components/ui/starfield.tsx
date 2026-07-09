import { useMemo } from "react";

interface StarfieldProps {
  density?: number;
  className?: string;
}

export function Starfield({ density = 32, className = "" }: StarfieldProps) {
  const stars = useMemo(() => {
    return Array.from({ length: density }, (_, i) => ({
      id: i,
      size: Math.random() > 0.8 ? 2 : 1,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 4,
      opacity: 0.25 + Math.random() * 0.35,
      duration: 2 + Math.random() * 4,
    }));
  }, [density]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white/70 animate-twinkle"
          style={{
            width: star.size,
            height: star.size,
            left: `${star.left}%`,
            top: `${star.top}%`,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
            opacity: star.opacity,
          }}
        />
      ))}
    </div>
  );
}
