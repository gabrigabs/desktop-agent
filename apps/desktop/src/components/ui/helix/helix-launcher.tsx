import { HELIX_ACTIONS, type HelixAction, type HelixSecondaryAction } from "@desktop-agent/shared";
import { ArrowLeft, Orbit } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LAUNCHER_MENU_SIZE,
  LAUNCHER_SECONDARY_WIDTH,
  setLauncherMenuOpen,
  startWindowDrag,
} from "../../../lib/window";
import { HELIX_ACTION_ICONS } from "./helix-action-icon";
import { Pet } from "./pet";

interface HelixLauncherProps {
  petSize: number;
  onOpenNormal: () => void;
  onAction: (action: HelixAction, secondaryAction?: HelixSecondaryAction) => void;
  onQuickAction?: (action: HelixAction, secondaryAction: HelixSecondaryAction) => void;
}

const MENU_SIZE = LAUNCHER_MENU_SIZE;
const ORBIT_RADIUS = 122;
const START_ANGLE = -72;
const RAY_OFFSET = 34;
const HIT_SIZE = 44;

function useRadialActions() {
  const { t } = useTranslation("helix");
  return HELIX_ACTIONS.map((action) => ({
    ...action,
    source: action,
    label: t(`helix:radialActions.${action.id}.title`),
    description: t(`helix:radialActions.${action.id}.description`),
    icon: HELIX_ACTION_ICONS[action.icon] ?? Orbit,
    accent: action.color,
    bg: `${action.color}2e`,
    secondaryActions:
      action.secondaryActions?.map((secondary) => ({
        ...secondary,
        source: secondary,
        label: secondary.title,
        description: secondary.description,
        icon: HELIX_ACTION_ICONS[secondary.icon ?? action.icon] ?? Orbit,
        accent: action.color,
        bg: `${action.color}2e`,
      })) ?? [],
  }));
}

export function HelixLauncher(props: HelixLauncherProps) {
  const { t } = useTranslation("helix");
  const { petSize, onOpenNormal } = props;
  const actions = useRadialActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [clickingIndex, setClickingIndex] = useState<number | null>(null);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [secondaryIndex, setSecondaryIndex] = useState(0);
  const [launchingLabel, setLaunchingLabel] = useState<string | null>(null);

  const activeAction = menuOpen ? actions[selectedIndex] : undefined;
  const clipboardAction = actions.find((action) => action.id === "clipboard");
  const screenAction = actions.find((action) => action.id === "screen");
  const idleActions = [
    clipboardAction?.secondaryActions.find((action) => action.id === "clipboard-summarize"),
    screenAction?.secondaryActions.find((action) => action.id === "screen-region"),
    clipboardAction?.secondaryActions.find((action) => action.id === "clipboard-translate"),
  ].filter((action): action is NonNullable<typeof action> => Boolean(action));
  const activeAngle = menuOpen ? START_ANGLE - selectedIndex * (360 / actions.length) : 0;
  const activeItemAngle = START_ANGLE - selectedIndex * (360 / actions.length);
  const secondarySide = Math.cos(activeItemAngle * (Math.PI / 180)) >= 0 ? "right" : "left";

  const clickCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; started: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      window.addEventListener("mousedown", handleClickOutside);
    }
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    setLauncherMenuOpen(menuOpen, secondaryOpen ? activeAction?.secondaryActions.length : 0, secondarySide);
  }, [activeAction?.secondaryActions.length, menuOpen, secondaryOpen, secondarySide]);

  const handleClick = () => {
    if (isDragging) {
      setIsDragging(false);
      return;
    }

    if (secondaryOpen) {
      setSecondaryOpen(false);
      setSecondaryIndex(0);
      return;
    }

    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    clickCount.current += 1;
    if (clickCount.current === 1) {
      timerRef.current = setTimeout(() => {
        clickCount.current = 0;
        setMenuOpen(true);
        setSelectedIndex(0);
        setSecondaryOpen(false);
        setSecondaryIndex(0);
      }, 160);
    } else if (clickCount.current === 2) {
      if (timerRef.current) clearTimeout(timerRef.current);
      clickCount.current = 0;
      setMenuOpen(false);
      onOpenNormal();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY, started: false };
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (menuOpen || !dragStartRef.current || dragStartRef.current.started) return;

    const dx = Math.abs(e.clientX - dragStartRef.current.x);
    const dy = Math.abs(e.clientY - dragStartRef.current.y);

    if (dx > 12 || dy > 12) {
      if (timerRef.current) clearTimeout(timerRef.current);
      clickCount.current = 0;
      dragStartRef.current.started = true;
      setIsDragging(true);
      startWindowDrag();
    }
  };

  const handleMouseUp = () => {
    dragStartRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!menuOpen) return;

    if (secondaryOpen) {
      const secondaries = actions[selectedIndex]?.secondaryActions ?? [];
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setSecondaryIndex((i) => (i + 1) % secondaries.length);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSecondaryIndex((i) => (i - 1 + secondaries.length) % secondaries.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        executeSecondaryAction(selectedIndex, secondaryIndex);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSecondaryOpen(false);
        setSecondaryIndex(0);
      }
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (selectedIndex + 1) % actions.length;
      setSelectedIndex(next);
      setSecondaryOpen(false);
      setSecondaryIndex(0);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (selectedIndex - 1 + actions.length) % actions.length;
      setSelectedIndex(next);
      setSecondaryOpen(false);
      setSecondaryIndex(0);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const action = actions[selectedIndex];
      if (action?.secondaryActions?.length) {
        setSecondaryOpen(true);
        setSecondaryIndex(0);
      } else {
        executeAction(selectedIndex);
      }
    } else if (/^[1-6]$/.test(e.key)) {
      e.preventDefault();
      const index = Number(e.key) - 1;
      const action = actions[index];
      if (action?.secondaryActions?.length) {
        setSelectedIndex(index);
        setSecondaryOpen(true);
        setSecondaryIndex(0);
      } else {
        executeAction(index);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMenuOpen(false);
    }
  };

  const executeAction = (index: number) => {
    const action = actions[index];
    if (!action) return;

    setClickingIndex(index);
    setLaunchingLabel(action.label);
    setTimeout(() => {
      setClickingIndex(null);
      props.onAction(action.source);
      setMenuOpen(false);
      setSecondaryOpen(false);
      setSecondaryIndex(0);
      setLaunchingLabel(null);
    }, 140);
  };

  const executeSecondaryAction = (primaryIndex: number, index: number) => {
    const action = actions[primaryIndex];
    const secondary = action?.secondaryActions?.[index];
    if (!action || !secondary) return;

    setClickingIndex(primaryIndex);
    setLaunchingLabel(secondary.label);
    setTimeout(() => {
      setClickingIndex(null);
      props.onAction(action.source, secondary.source);
      setMenuOpen(false);
      setSecondaryOpen(false);
      setSecondaryIndex(0);
      setLaunchingLabel(null);
    }, 140);
  };

  return (
    <div ref={containerRef} className="helix-launcher relative h-full w-full overflow-visible">
      <div
        className={`absolute flex items-center justify-center overflow-visible rounded-full ${
          menuOpen ? "top-1/2 h-[380px] w-[380px] -translate-y-1/2" : "inset-0 h-full w-full"
        }`}
        style={{
          left: menuOpen && secondaryOpen && secondarySide === "left" ? LAUNCHER_SECONDARY_WIDTH - 10 : 0,
        }}
      >
        {!menuOpen &&
          idleActions.map((action, index) => {
            const Icon = action.icon;
            const positions = [
              "left-1 top-1/2 -translate-y-1/2",
              "left-1/2 top-1 -translate-x-1/2",
              "right-1 top-1/2 -translate-y-1/2",
            ];
            const primary = action.id === "screen-region" ? screenAction : clipboardAction;
            if (!primary) return null;
            return (
              <button
                key={action.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (props.onQuickAction) {
                    props.onQuickAction(primary.source, action.source);
                  } else {
                    props.onAction(primary.source, action.source);
                  }
                }}
                className={`absolute z-40 flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.09] bg-[rgba(18,16,25,0.96)] text-mute shadow-md transition-colors hover:border-signal/35 hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 ${positions[index]}`}
                aria-label={action.label}
                title={action.label}
              >
                <Icon size={11} />
              </button>
            );
          })}

        {/* Dynamic background that makes the pet stand out on bright wallpapers */}
        <div
          className={`absolute rounded-full pointer-events-none transition-all duration-300 ease-out ${
            menuOpen ? "w-full h-full opacity-[0.98]" : "w-[78px] h-[78px] opacity-[0.94]"
          }`}
          style={{
            background:
              "radial-gradient(circle at 48% 44%, rgba(27, 24, 36, 0.96) 0%, rgba(13, 12, 19, 0.95) 62%, rgba(8, 7, 12, 0.9) 100%)",
            backdropFilter: "blur(20px) saturate(108%)",
            WebkitBackdropFilter: "blur(20px) saturate(108%)",
            boxShadow: menuOpen
              ? "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.035)"
              : "inset 0 0 0 1px rgba(255,255,255,0.07)",
          }}
        />

        {!menuOpen && (
          <svg
            className="pointer-events-none absolute left-1/2 top-1/2 h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2"
            viewBox="0 0 84 84"
            fill="none"
            aria-hidden="true"
          >
            <path
              className="helix-launcher-arc helix-launcher-arc-a"
              d="M15 45 C18 66 58 72 70 46"
              stroke="rgba(196, 153, 244, 0.68)"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeDasharray="18 7 2 12"
            />
            <path
              className="helix-launcher-arc helix-launcher-arc-b"
              d="M20 29 C31 12 57 13 66 31"
              stroke="rgba(120, 221, 232, 0.46)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray="3 9 14 8"
            />
          </svg>
        )}

        {menuOpen && (
          <>
            {/* Functional orbit guides */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${MENU_SIZE} ${MENU_SIZE}`}
              aria-hidden="true"
            >
              <circle
                cx={MENU_SIZE / 2}
                cy={MENU_SIZE / 2}
                r={ORBIT_RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.085)"
                strokeWidth="1"
                strokeDasharray="2 10"
              />
              <circle
                cx={MENU_SIZE / 2}
                cy={MENU_SIZE / 2}
                r={ORBIT_RADIUS - 26}
                fill="none"
                stroke="rgba(185,130,255,0.09)"
                strokeWidth="1"
                strokeDasharray="4 14"
              />
            </svg>

            {/* Orbital selection ray */}
            {activeAction && (
              <div
                className="radial-ray absolute top-1/2 left-1/2 pointer-events-none"
                style={{
                  ["--accent-color" as string]: activeAction.accent,
                  width: ORBIT_RADIUS - RAY_OFFSET,
                  height: 1,
                  borderRadius: 9999,
                  background: `linear-gradient(90deg, var(--accent-color), transparent)`,
                  transform: `translate(0, -50%) rotate(${activeAngle}deg)`,
                  transformOrigin: "0 50%",
                  opacity: 0.52,
                }}
              />
            )}

            {/* Moon actions */}
            {actions.map((action, index) => {
              const itemAngle = START_ANGLE - index * (360 / actions.length);
              const angle = itemAngle * (Math.PI / 180);
              const x = Math.round(MENU_SIZE / 2 + ORBIT_RADIUS * Math.cos(angle));
              const y = Math.round(MENU_SIZE / 2 + ORBIT_RADIUS * Math.sin(angle));
              const isSelected = index === selectedIndex;
              const isClicking = index === clickingIndex;
              const baseScale = isSelected ? 1.1 : 1;

              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    if (secondaryOpen) return;
                    if (action.secondaryActions?.length) {
                      setSelectedIndex(index);
                      setSecondaryOpen(true);
                      setSecondaryIndex(0);
                    } else {
                      executeAction(index);
                    }
                  }}
                  onMouseEnter={() => {
                    if (secondaryOpen) return;
                    setSelectedIndex(index);
                  }}
                  onFocus={() => {
                    if (!secondaryOpen) setSelectedIndex(index);
                  }}
                  onKeyDown={handleKeyDown}
                  className="radial-item-enter absolute focus:outline-none"
                  aria-label={`${action.label}: ${action.description}. ${t("helix:helixLauncher.shortcut", { index: index + 1 })}`}
                  title={`${action.label} — ${action.description}`}
                  style={{
                    ["--accent-color" as string]: action.accent,
                    animationDelay: `${index * 0.02}s`,
                    left: x,
                    top: y,
                    transform: "translate(-50%, -50%)",
                    zIndex: isSelected ? 20 : 10,
                    opacity: secondaryOpen && !isSelected ? 0.38 : 1,
                    pointerEvents: secondaryOpen ? "none" : "auto",
                  }}
                >
                  <div
                    className={`radial-item flex flex-col items-center gap-2 ${
                      isClicking ? "radial-click" : ""
                    }`}
                    style={{
                      ["--base-scale" as string]: baseScale,
                      minWidth: HIT_SIZE,
                      minHeight: HIT_SIZE,
                      transform: `scale(${baseScale})`,
                    }}
                  >
                    <div
                      className="relative flex items-center justify-center rounded-[15px] transition-all duration-150"
                      style={{
                        width: 46,
                        height: 46,
                        background: isSelected ? action.bg : "rgba(255,255,255,0.035)",
                        border: isSelected
                          ? "1px solid var(--accent-color)"
                          : "1px solid rgba(255,255,255,0.1)",
                        boxShadow: isSelected
                          ? "0 8px 22px rgba(0,0,0,0.38), inset 0 0 14px color-mix(in srgb, var(--accent-color) 10%, transparent)"
                          : "0 6px 16px rgba(0,0,0,0.24)",
                      }}
                    >
                      <span className="absolute right-1.5 top-1 text-[7px] font-mono text-faint">
                        {index + 1}
                      </span>
                      <action.icon
                        className="transition-transform duration-300"
                        size={19}
                        style={{
                          color: "var(--accent-color)",
                          transform: isSelected ? "scale(1.08)" : "scale(1)",
                          filter: "none",
                        }}
                      />
                    </div>
                    <span
                      className="text-center text-[10px] font-semibold tracking-tight"
                      style={{
                        color: isSelected ? "#f4f0ff" : "#a8a0ba",
                        lineHeight: 1.2,
                        maxWidth: 92,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {action.label}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Secondary actions orbit beside the radial and grow vertically with their content. */}
            {secondaryOpen && activeAction && activeAction.secondaryActions.length > 0 && (
              <div
                className="absolute top-1/2 z-50 -translate-y-1/2 rounded-[22px] border border-white/[0.09] bg-[rgba(16,14,22,0.97)] p-3 backdrop-blur-xl"
                style={{
                  left: secondarySide === "right" ? MENU_SIZE - 10 : undefined,
                  right: secondarySide === "left" ? MENU_SIZE - 10 : undefined,
                  width: LAUNCHER_SECONDARY_WIDTH,
                }}
                role="menu"
                aria-label={t("helix:helixLauncher.secondaryActions")}
              >
                <div className="mb-2 flex items-center gap-2 border-b border-white/[0.07] pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSecondaryOpen(false);
                      setSecondaryIndex(0);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-signal/20 bg-signal/[0.07] text-signal transition-colors hover:bg-signal/[0.14]"
                    aria-label={t("helix:helixLauncher.back")}
                    title={t("helix:helixLauncher.back")}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold text-fg">{activeAction.label}</div>
                    <div className="text-[8px] uppercase tracking-[0.14em] text-faint">
                      {t("helix:helixLauncher.secondaryActions")}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {activeAction.secondaryActions.map((secondary, sIndex) => {
                    const SecondaryIcon = secondary.icon;
                    const isActive = sIndex === secondaryIndex;
                    return (
                      <button
                        key={secondary.id}
                        type="button"
                        role="menuitem"
                        onClick={() => executeSecondaryAction(selectedIndex, sIndex)}
                        onMouseEnter={() => setSecondaryIndex(sIndex)}
                        onFocus={() => setSecondaryIndex(sIndex)}
                        onKeyDown={handleKeyDown}
                        className="flex h-10 min-w-0 items-center gap-2 rounded-xl border px-2 text-left transition-colors focus:outline-none"
                        style={{
                          color: isActive ? "#f4f0ff" : "#a8a0ba",
                          background: isActive ? activeAction.bg : "rgba(255,255,255,0.025)",
                          borderColor: isActive ? `${activeAction.accent}80` : "rgba(255,255,255,0.07)",
                        }}
                        title={secondary.description}
                        aria-label={`${secondary.label}: ${secondary.description ?? ""}`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                          <SecondaryIcon size={14} style={{ color: activeAction.accent }} />
                        </span>
                        <span className="min-w-0 break-words text-[10px] font-semibold leading-tight">
                          {secondary.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-[34%] border border-white/[0.05]" />
          </>
        )}

        {/* Central planet / pet */}
        <button
          type="button"
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onKeyDown={handleKeyDown}
          className={`relative z-30 flex items-center justify-center rounded-[34%] cursor-pointer transition-all duration-200 bg-transparent border-0 p-0 focus:outline-none hover:scale-[1.025] ${
            menuOpen ? "scale-[1.02]" : ""
          }`}
          style={{
            width: menuOpen ? 82 : "100%",
            height: menuOpen ? 82 : "100%",
          }}
          data-tauri-drag-region={!menuOpen}
          aria-label={
            secondaryOpen
              ? t("helix:helixLauncher.back")
              : menuOpen
                ? t("helix:helixLauncher.closeMenu")
                : t("helix:helixLauncher.openHelix")
          }
          title={
            secondaryOpen
              ? t("helix:helixLauncher.back")
              : menuOpen
                ? t("helix:helixLauncher.closeMenuHint")
                : t("helix:helixLauncher.openMenuHint")
          }
        >
          <div className="relative">
            <Pet size={menuOpen ? 72 : petSize} variant={menuOpen ? "full" : "compact"} glow={menuOpen} />
          </div>
        </button>

        {menuOpen && activeAction && !secondaryOpen && (
          <div
            className="pointer-events-none absolute left-1/2 top-[calc(50%+45px)] z-40 w-[178px] -translate-x-1/2 text-center radial-preview"
            aria-live="polite"
          >
            <div className="text-[10px] font-semibold tracking-wide text-fg">
              {launchingLabel ?? activeAction.label}
            </div>
            <div className="mt-0.5 text-[8px] leading-tight text-mute">
              {launchingLabel ? t("helix:helixLauncher.openingAction") : activeAction.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
