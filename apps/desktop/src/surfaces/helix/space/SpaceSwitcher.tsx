import { Check, ChevronDown, Layers3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgentStore } from "../../../stores/agent";
import { SpaceIcon } from "./space-visuals";

export function SpaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("helix");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const spaces = useAgentStore((state) => state.spaces);
  const activeSpaceId = useAgentStore((state) => state.activeSpaceId);
  const setActiveSpaceId = useAgentStore((state) => state.setActiveSpaceId);
  const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const select = (id: string | null) => {
    setActiveSpaceId(id);
    if (id) localStorage.setItem("helix.active-space-id", id);
    else localStorage.removeItem("helix.active-space-id");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-white/[0.025] text-mute transition-colors hover:border-line-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 ${compact ? "h-7 px-2 text-[10px]" : "h-8 px-2.5 text-[11px]"}`}
      >
        {activeSpace ? (
          <span className="shrink-0" style={{ color: activeSpace.color }}>
            <SpaceIcon icon={activeSpace.icon} className="h-3.5 w-3.5" />
          </span>
        ) : (
          <Layers3 className="h-3.5 w-3.5 shrink-0 text-faint" />
        )}
        <span className="truncate font-medium">
          {activeSpace?.name ?? t("helix:space.noActiveSpace", "Sem Espaço")}
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-[calc(100%+6px)] left-0 z-50 max-h-64 min-w-56 overflow-y-auto rounded-xl border border-line-strong bg-[rgba(18,16,24,0.98)] p-1.5 shadow-2xl backdrop-blur-xl"
        >
          <button
            type="button"
            role="option"
            aria-selected={!activeSpaceId}
            onClick={() => select(null)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-mute transition-colors hover:bg-white/[0.05] hover:text-fg"
          >
            <Layers3 className="h-3.5 w-3.5 text-faint" />
            <span className="flex-1">{t("helix:space.noActiveSpace", "Sem Espaço")}</span>
            {!activeSpaceId && <Check className="h-3.5 w-3.5 text-signal" />}
          </button>
          {spaces.map((space) => (
            <button
              key={space.id}
              type="button"
              role="option"
              aria-selected={space.id === activeSpaceId}
              onClick={() => select(space.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-mute transition-colors hover:bg-white/[0.05] hover:text-fg"
            >
              <span className="shrink-0" style={{ color: space.color }}>
                <SpaceIcon icon={space.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate">{space.name}</span>
              {space.id === activeSpaceId && <Check className="h-3.5 w-3.5 shrink-0 text-signal" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
