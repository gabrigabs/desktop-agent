import type { AgentProfile } from "@desktop-agent/shared";
import { Bot, Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ProfileSwitchProps {
  profiles: AgentProfile[];
  activeProfileId: string | null;
  onSetActiveProfile: (profileId: string | null) => void;
  compact?: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {};

export function ProfileSwitch({
  profiles,
  activeProfileId,
  onSetActiveProfile,
  compact,
}: ProfileSwitchProps) {
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

  const activeLabel = active ? active.name : t("helix:agentIdentity.default");
  const Icon = active?.icon ? (ICON_MAP[active.icon] ?? Bot) : Bot;

  const trigger = compact ? (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="flex items-center gap-1 text-xs text-mute hover:text-fg transition-colors"
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="truncate max-w-[120px]">{activeLabel}</span>
      <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="group flex items-center gap-1.5 text-sm text-mute hover:text-fg transition-colors"
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      <span className="text-fg font-semibold">Helix</span>
      <span className="text-faint">·</span>
      <span className="flex items-center gap-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="truncate max-w-[140px]">{activeLabel}</span>
      </span>
      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );

  return (
    <div ref={ref} className="relative">
      {trigger}
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
