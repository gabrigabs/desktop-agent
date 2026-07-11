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
        expanded ? "py-4" : "py-2"
      }`}
    >
      <div
        className="absolute inset-0 -z-10 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 50% 52%, rgba(196, 155, 244, 0.11) 0%, rgba(120, 221, 232, 0.025) 34%, transparent 62%)",
        }}
      />

      <div className="hero-enter relative flex items-center justify-center">
        <Pet size={expanded ? 166 : 126} variant="hero" glow />
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
          .hero-enter { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
