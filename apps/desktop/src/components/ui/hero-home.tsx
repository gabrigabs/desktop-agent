import type { AgentProfile } from "@desktop-agent/shared";
import type { ReactNode } from "react";
import { Pet } from "./pet";
import { ProfileSwitch } from "./profile-switch";

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
      <div
        className="absolute inset-0 -z-10 pointer-events-none opacity-55"
        style={{
          background: "radial-gradient(ellipse at 50% 55%, rgba(185, 130, 255, 0.12) 0%, transparent 42%)",
        }}
      />

      {/* Symbol wrapper: rings and Pet centered together */}
      <div className="relative flex items-center justify-center">
        <svg
          className="-z-10 pointer-events-none"
          width={expanded ? 250 : 210}
          height={expanded ? 190 : 164}
          viewBox="0 0 220 170"
          aria-hidden="true"
        >
          <ellipse
            cx="110"
            cy="85"
            rx={expanded ? 94 : 78}
            ry={expanded ? 44 : 38}
            transform="rotate(-14 110 85)"
            fill="none"
            stroke="rgba(185, 130, 255, 0.12)"
            strokeWidth="1"
            strokeDasharray="18 12 3 15"
            className="animate-spin-slow"
          />
          <ellipse
            cx="110"
            cy="85"
            rx={expanded ? 76 : 66}
            ry={expanded ? 56 : 48}
            transform="rotate(28 110 85)"
            fill="none"
            stroke="rgba(53, 214, 255, 0.07)"
            strokeWidth="1"
            strokeDasharray="4 17"
          />
        </svg>

        {/* Hero pet with entrance animation */}
        <div className="hero-enter absolute z-10 p-4 flex items-center justify-center">
          <Pet size={expanded ? 124 : 104} variant="hero" glow />
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
