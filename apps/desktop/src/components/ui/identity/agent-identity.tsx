import type { AgentProfile } from "@desktop-agent/shared";
import { Bot, Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface AgentIdentityProps {
  profiles: AgentProfile[];
  activeProfileId: string | null;
  onSetActiveProfile: (profileId: string | null) => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {};

export function AgentIdentity({ profiles, activeProfileId, onSetActiveProfile }: AgentIdentityProps) {
  const { t } = useTranslation("helix");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = profiles.find((p) => p.id === activeProfileId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("mousedown", handleClickOutside);
    }
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const label = active ? active.name : t("helix:agentIdentity.default");
  const Icon = active?.icon ? (ICON_MAP[active.icon] ?? Bot) : Bot;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-full border border-line bg-white/[0.03] text-xs text-fg hover:bg-white/[0.06] hover:border-line-strong transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t("helix:agentIdentity.switchProfile")}
      >
        <span className="relative flex items-center justify-center">
          <Icon className="w-3.5 h-3.5" />
          <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-signal border border-ink" />
        </span>
        <span className="truncate max-w-[120px] font-medium">{label}</span>
        <ChevronDown className={`w-3 h-3 text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 min-w-[200px] max-w-[260px] rounded-xl border border-line bg-[#151320]/95 backdrop-blur-xl p-1.5 z-50 shadow-2xl"
          role="listbox"
        >
          <button
            type="button"
            onClick={() => {
              onSetActiveProfile(null);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors ${
              activeProfileId === null ? "bg-signal/10 text-signal" : "text-fg hover:bg-white/[0.04]"
            }`}
            role="option"
            aria-selected={activeProfileId === null}
          >
            <Bot className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left font-medium">{t("helix:agentIdentity.default")}</span>
            {activeProfileId === null && <Check className="w-3.5 h-3.5 shrink-0" />}
          </button>
          {profiles.map((profile) => {
            const ProfileIcon = profile.icon ? (ICON_MAP[profile.icon] ?? Bot) : Bot;
            const isActive = activeProfileId === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  onSetActiveProfile(profile.id);
                  setOpen(false);
                }}
                className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                  isActive ? "bg-signal/10 text-signal" : "text-fg hover:bg-white/[0.04]"
                }`}
                role="option"
                aria-selected={isActive}
              >
                <ProfileIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium truncate">{profile.name}</div>
                  {profile.description && (
                    <div className="text-[10px] text-faint leading-relaxed line-clamp-2 mt-0.5">
                      {profile.description}
                    </div>
                  )}
                </div>
                {isActive && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
