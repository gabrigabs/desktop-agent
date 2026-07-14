import {
  AppWindow,
  Camera,
  Check,
  ChevronDown,
  Clipboard,
  FileText,
  FolderOpen,
  Globe,
  Layout,
  Monitor,
  ScanLine,
  ScanText,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ContextItem } from "./context-bar";

export interface ContextMenuSource {
  id: string;
  source: ContextItem["source"];
  labelKey: string;
  descriptionKey: string;
  icon: typeof Clipboard;
  mock: boolean;
}

export type ContextMenuCategory = {
  id: string;
  labelKey: string;
  icon: typeof Clipboard;
  sources: ContextMenuSource[];
};

export const CONTEXT_SOURCES: ContextMenuSource[] = [
  {
    id: "clipboard",
    source: "clipboard",
    labelKey: "composer.contextMenu.clipboard",
    descriptionKey: "composer.contextMenu.clipboardDescription",
    icon: Clipboard,
    mock: false,
  },
  {
    id: "screen-read",
    source: "screen",
    labelKey: "composer.contextMenu.screenRead",
    descriptionKey: "composer.contextMenu.screenReadDescription",
    icon: ScanText,
    mock: false,
  },
  {
    id: "screen-capture",
    source: "screen",
    labelKey: "composer.contextMenu.screenCapture",
    descriptionKey: "composer.contextMenu.screenCaptureDescription",
    icon: Camera,
    mock: false,
  },
  {
    id: "screen-region",
    source: "screen",
    labelKey: "composer.contextMenu.screenRegion",
    descriptionKey: "composer.contextMenu.screenRegionDescription",
    icon: ScanLine,
    mock: false,
  },
  {
    id: "screen-window",
    source: "screen",
    labelKey: "composer.contextMenu.screenWindow",
    descriptionKey: "composer.contextMenu.screenWindowDescription",
    icon: AppWindow,
    mock: false,
  },
  {
    id: "file",
    source: "file",
    labelKey: "composer.contextMenu.file",
    descriptionKey: "composer.contextMenu.fileDescription",
    icon: FileText,
    mock: false,
  },
  {
    id: "folder",
    source: "file",
    labelKey: "composer.contextMenu.folder",
    descriptionKey: "composer.contextMenu.folderDescription",
    icon: FolderOpen,
    mock: false,
  },
  {
    id: "active-app",
    source: "active_app",
    labelKey: "composer.contextMenu.activeApp",
    descriptionKey: "composer.contextMenu.activeAppDescription",
    icon: Layout,
    mock: false,
  },
  {
    id: "connector",
    source: "connector",
    labelKey: "composer.contextMenu.connector",
    descriptionKey: "composer.contextMenu.connectorDescription",
    icon: Globe,
    mock: false,
  },
];

export const CONTEXT_CATEGORIES: ContextMenuCategory[] = [
  {
    id: "context",
    labelKey: "composer.contextMenu.categoryContext",
    icon: Clipboard,
    sources: CONTEXT_SOURCES.filter((s) => s.id === "clipboard"),
  },
  {
    id: "screen",
    labelKey: "composer.contextMenu.categoryScreen",
    icon: Monitor,
    sources: CONTEXT_SOURCES.filter((s) => s.source === "screen"),
  },
  {
    id: "files",
    labelKey: "composer.contextMenu.categoryFiles",
    icon: FileText,
    sources: CONTEXT_SOURCES.filter((s) => s.id === "file" || s.id === "folder"),
  },
  {
    id: "apps",
    labelKey: "composer.contextMenu.categoryApps",
    icon: Layout,
    sources: CONTEXT_SOURCES.filter((s) => s.id === "active-app" || s.id === "connector"),
  },
];

interface ContextMenuPopupProps {
  open: boolean;
  onClose: () => void;
  activeSources: Set<string>;
  onToggle: (source: ContextMenuSource) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  composerRef: React.RefObject<HTMLDivElement | null>;
}

export function ContextMenuPopup({
  open,
  onClose,
  activeSources,
  onToggle,
  anchorRef,
  composerRef,
}: ContextMenuPopupProps) {
  const { t } = useTranslation("helix");
  const popupRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [animateIn, setAnimateIn] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["context"]));

  const allFlatSources = CONTEXT_CATEGORIES.flatMap((cat) => cat.sources);

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setAnimateIn(false);
      setFocusedIndex(-1);
      return;
    }
    const frame = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node) &&
        !composerRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev + 1;
          if (next >= allFlatSources.length) return 0;
          return next;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev - 1;
          if (next < 0) return allFlatSources.length - 1;
          return next;
        });
        return;
      }
      if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        const src = allFlatSources[focusedIndex];
        if (src && !src.mock) onToggle(src);
        return;
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, anchorRef, composerRef, focusedIndex, onToggle, allFlatSources]);

  useEffect(() => {
    if (focusedIndex < 0) return;
    const el = itemRefs.current[focusedIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusedIndex]);

  const handleMouseEnter = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  if (!open) return null;

  let flatIndex = 0;
  return (
    <div
      ref={popupRef}
      className={`w-full overflow-hidden bg-black/[0.15] transition-all duration-200 ease-out ${
        animateIn ? "opacity-100" : "opacity-0"
      }`}
      role="menu"
      aria-label={t("helix:composer.contextMenu.title")}
    >
      <div
        ref={scrollRef}
        style={{ scrollPaddingTop: 4, scrollPaddingBottom: 4 }}
        className={`overflow-y-auto px-1.5 pb-1.5 transition-[max-height,padding,opacity] duration-200 ease-out [
          &::-webkit-scrollbar]:w-1
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-line/30
          [&::-webkit-scrollbar-thumb:hover]:bg-line/50
          ${animateIn ? "max-h-[min(380px,58vh)] pt-1.5 opacity-100" : "max-h-0 pt-0 opacity-0"}`}
      >
        {CONTEXT_CATEGORIES.map((category) => {
          const CatIcon = category.icon;
          const isExpanded = expandedCategories.has(category.id);
          const hasActive = category.sources.some((s) => activeSources.has(s.id));
          return (
            <div key={category.id} className="mb-0.5">
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="group flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${hasActive ? "text-signal" : "text-mute group-hover:text-fg"}`}
                >
                  <CatIcon className="h-3 w-3" />
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${hasActive ? "text-signal" : "text-mute group-hover:text-fg"}`}
                >
                  {t(`helix:${category.labelKey}`)}
                </span>
                {hasActive && <span className="h-1 w-1 rounded-full bg-signal shrink-0" />}
                <ChevronDown
                  className={`ml-auto h-3 w-3 shrink-0 text-faint transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                />
              </button>
              {isExpanded &&
                category.sources.map((src) => {
                  const index = flatIndex++;
                  const Icon = src.icon;
                  const isActive = activeSources.has(src.id);
                  const isFocused = focusedIndex === index;
                  return (
                    <button
                      key={src.id}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      type="button"
                      onClick={() => onToggle(src)}
                      onMouseEnter={() => handleMouseEnter(index)}
                      disabled={src.mock}
                      className={`group flex w-full items-center gap-2 rounded-lg pl-7 pr-1.5 py-1 text-left transition-all duration-150 ${
                        isActive ? "bg-signal/10" : isFocused ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                      } disabled:cursor-default disabled:opacity-30`}
                      role="menuitem"
                      style={{
                        transitionDelay: `${index * 20}ms`,
                        transform: animateIn ? "translateY(0)" : "translateY(4px)",
                        opacity: animateIn ? 1 : 0,
                      }}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all duration-200 group-hover:scale-110 ${
                          isActive
                            ? "border-signal/30 bg-signal/10 text-signal"
                            : isFocused
                              ? "border-signal/20 bg-signal/5 text-signal"
                              : "border-line/60 bg-ink/20 text-mute group-hover:border-signal/20 group-hover:text-signal"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] font-medium transition-colors ${
                              isActive ? "text-signal" : isFocused ? "text-signal" : "text-fg"
                            }`}
                          >
                            {t(`helix:${src.labelKey}`)}
                          </span>
                          {isActive && !src.mock && (
                            <Check className="h-3 w-3 text-signal animate-check-pop" />
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[10px] leading-tight text-faint">
                          {t(`helix:${src.descriptionKey}`)}
                        </p>
                        {src.mock && (
                          <span className="text-[7px] uppercase tracking-wide text-faint rounded px-1 py-0.5 border border-line/40">
                            {t("helix:contextBar.soon")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
