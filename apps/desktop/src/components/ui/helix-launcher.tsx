import { HELIX_ACTIONS, type HelixAction } from "@desktop-agent/shared";
import { Clipboard, Globe, MessageCircle, Orbit, Scan, Workflow } from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";
import { setLauncherMenuOpen, startWindowDrag } from "../../lib/window";
import { Pet } from "./pet";

interface HelixLauncherProps {
  petSize: number;
  onOpenNormal: () => void;
  onAction: (action: HelixAction) => void;
}

const MENU_SIZE = 420;
const ORBIT_RADIUS = 142;
const START_ANGLE = -72;
const RAY_OFFSET = 28;
const HIT_SIZE = 48;

const ACTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "message-circle": MessageCircle,
  clipboard: Clipboard,
  scan: Scan,
  globe: Globe,
  workflow: Workflow,
  orbit: Orbit,
};

const actions = HELIX_ACTIONS.map((action) => ({
  ...action,
  source: action,
  label: action.title,
  icon: ACTION_ICONS[action.icon] ?? Orbit,
  accent: action.color,
  bg: `${action.color}2e`,
}));

export function HelixLauncher(props: HelixLauncherProps) {
  const { petSize, onOpenNormal } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [clickingIndex, setClickingIndex] = useState<number | null>(null);

  const activeAction = menuOpen ? actions[selectedIndex] : undefined;
  const activeAngle = menuOpen ? START_ANGLE - selectedIndex * (360 / actions.length) : 0;

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
    setLauncherMenuOpen(menuOpen);
  }, [menuOpen]);

  const handleClick = () => {
    if (isDragging) {
      setIsDragging(false);
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

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (selectedIndex + 1) % actions.length;
      setSelectedIndex(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (selectedIndex - 1 + actions.length) % actions.length;
      setSelectedIndex(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      executeAction(selectedIndex);
    } else if (/^[1-6]$/.test(e.key)) {
      e.preventDefault();
      executeAction(Number(e.key) - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMenuOpen(false);
    }
  };

  const executeAction = (index: number) => {
    const action = actions[index];
    if (!action) return;

    setClickingIndex(index);
    setTimeout(() => {
      setClickingIndex(null);
      props.onAction(action.source);
      setMenuOpen(false);
    }, 300);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full h-full overflow-hidden rounded-full"
      style={{ clipPath: menuOpen ? "circle(50%)" : undefined }}
    >
      {/* Dynamic background that makes the pet stand out on bright wallpapers */}
      <div
        className={`absolute rounded-full pointer-events-none transition-all duration-500 ease-out ${
          menuOpen ? "w-full h-full opacity-95" : "w-[96px] h-[96px] opacity-85"
        }`}
        style={{
          background:
            "radial-gradient(circle at 48% 44%, rgba(31, 26, 44, 0.97) 0%, rgba(14, 12, 22, 0.94) 58%, rgba(8, 7, 13, 0.88) 100%)",
          backdropFilter: "blur(18px) saturate(115%)",
          WebkitBackdropFilter: "blur(18px) saturate(115%)",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.09), inset 0 0 0 7px rgba(255,255,255,0.012), 0 26px 70px rgba(0,0,0,0.48)",
        }}
      />

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
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
              strokeDasharray="3 9"
            />
            <circle
              cx={MENU_SIZE / 2}
              cy={MENU_SIZE / 2}
              r={ORBIT_RADIUS - 28}
              fill="none"
              stroke="rgba(185,130,255,0.14)"
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
                onClick={() => executeAction(index)}
                onMouseEnter={() => setSelectedIndex(index)}
                onFocus={() => setSelectedIndex(index)}
                className="radial-item-enter absolute focus:outline-none"
                aria-label={`${action.label}: ${action.description}. Atalho ${index + 1}`}
                title={`${action.label} — ${action.description}`}
                style={{
                  ["--accent-color" as string]: action.accent,
                  animationDelay: `${index * 0.04}s`,
                  left: x,
                  top: y,
                  transform: "translate(-50%, -50%)",
                  zIndex: isSelected ? 20 : 10,
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
                    className="relative flex items-center justify-center rounded-2xl transition-all duration-200"
                    style={{
                      width: 52,
                      height: 52,
                      background: isSelected ? action.bg : "rgba(255,255,255,0.035)",
                      border: isSelected
                        ? "1px solid var(--accent-color)"
                        : "1px solid rgba(255,255,255,0.1)",
                      boxShadow: isSelected
                        ? "0 10px 28px rgba(0,0,0,0.42), inset 0 0 18px color-mix(in srgb, var(--accent-color) 12%, transparent)"
                        : "0 8px 20px rgba(0,0,0,0.26)",
                    }}
                  >
                    <span className="absolute right-1.5 top-1 text-[7px] font-mono text-faint">
                      {index + 1}
                    </span>
                    <action.icon
                      className="transition-transform duration-300"
                      size={22}
                      style={{
                        color: "var(--accent-color)",
                        transform: isSelected ? "scale(1.08)" : "scale(1)",
                        filter: "none",
                      }}
                    />
                  </div>
                  <span
                    className="text-center text-[11px] font-semibold tracking-tight"
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

          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[112px] w-[112px] -translate-x-1/2 -translate-y-1/2 rounded-[38%] border border-white/[0.055]" />
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
        className={`relative z-30 flex items-center justify-center rounded-[38%] cursor-pointer transition-transform duration-300 bg-transparent border-0 p-0 focus:outline-none hover:scale-105 ${
          menuOpen ? "scale-105" : ""
        }`}
        style={{
          width: menuOpen ? 96 : "100%",
          height: menuOpen ? 96 : "100%",
        }}
        data-tauri-drag-region={!menuOpen}
        aria-label={menuOpen ? "Fechar menu" : "Abrir Helix"}
        title={menuOpen ? "Clique para fechar menu" : "Clique para abrir menu, arraste para mover"}
      >
        <div className="relative">
          <Pet size={menuOpen ? 78 : petSize} glow={menuOpen} />
        </div>
      </button>
    </div>
  );
}
