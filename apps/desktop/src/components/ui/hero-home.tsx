import type { AgentProfile } from "@desktop-agent/shared";
import type { ReactNode } from "react";
import { Pet } from "./pet";
import { ProfileSwitch } from "./profile-switch";
import { Starfield } from "./starfield";

interface HeroHomeProps {
  expanded?: boolean;
  footer?: ReactNode;
  profiles?: AgentProfile[];
  activeProfileId?: string | null;
  onSetActiveProfile?: (profileId: string | null) => void;
}

export function HeroHome({ expanded, footer, profiles, activeProfileId, onSetActiveProfile }: HeroHomeProps) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-2 overflow-visible w-full ${
        expanded ? "py-3" : "py-2"
      }`}
    >
      {/* Background layer: starfield, nebula and orbital rings */}
      <Starfield density={expanded ? 42 : 28} className="-z-10" />

      <div
        className="absolute inset-0 -z-10 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(circle at 50% 55%, rgba(196, 153, 244, 0.14) 0%, transparent 38%), radial-gradient(circle at 40% 45%, rgba(95, 208, 160, 0.08) 0%, transparent 30%)",
        }}
      />

      {/* Symbol wrapper: rings and Pet centered together */}
      <div className="relative flex items-center justify-center">
        <svg
          className="-z-10 pointer-events-none"
          width={expanded ? 260 : 200}
          height={expanded ? 260 : 200}
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          <circle
            cx="100"
            cy="100"
            r={expanded ? 72 : 60}
            fill="none"
            stroke="rgba(196, 153, 244, 0.10)"
            strokeWidth="1"
            strokeDasharray="6 10"
            className="animate-spin-slow"
          />
          <circle
            cx="100"
            cy="100"
            r={expanded ? 56 : 48}
            fill="none"
            stroke="rgba(95, 208, 160, 0.08)"
            strokeWidth="1"
            strokeDasharray="4 14"
            className="animate-spin-slow"
            style={{ animationDirection: "reverse", animationDuration: "32s" }}
          />
        </svg>

        {/* Hero pet with entrance animation */}
        <div className="hero-enter absolute z-10 p-4 flex items-center justify-center">
          <Pet size={expanded ? 92 : 72} variant="hero" glow />
        </div>
      </div>

      {/* Profile switch */}
      {onSetActiveProfile && (
        <div className="relative z-10 flex flex-col items-center gap-1">
          <ProfileSwitch
            profiles={profiles ?? []}
            activeProfileId={activeProfileId ?? null}
            onSetActiveProfile={onSetActiveProfile}
            compact
          />
        </div>
      )}

      {footer && <div className="relative z-10 w-full">{footer}</div>}

      <style>{`
        @keyframes hero-enter {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .hero-enter {
          animation: hero-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-enter, .animate-spin-slow, .animate-pulse-soft { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
