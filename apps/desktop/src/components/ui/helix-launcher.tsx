import { Clipboard, Globe, MessageSquarePlus, Scan, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { setLauncherMenuOpen, startWindowDrag } from "../../lib/window";
import { Pet } from "./pet";

interface HelixLauncherProps {
  petSize: number;
  onOpenNormal: () => void;
  onNewTask: () => void;
  onFreeAsk: () => void;
  onSearchWeb: () => void;
  onReadScreen: () => void;
}

const MENU_SIZE = 420;
const ORBIT_RADIUS = 142;
const START_ANGLE = -72;
const RAY_OFFSET = 28;
const HIT_SIZE = 48;

const actions = [
  {
    id: "new",
    label: "Nova",
    icon: MessageSquarePlus,
    accent: "#c499f4",
    bg: "rgba(196, 153, 244, 0.18)",
    onClick: (callbacks: HelixLauncherProps) => {
      callbacks.onNewTask();
      callbacks.onOpenNormal();
    },
  },
  {
    id: "ask",
    label: "Perguntar",
    icon: Search,
    accent: "#22d3ee",
    bg: "rgba(34, 211, 238, 0.18)",
    onClick: (callbacks: HelixLauncherProps) => {
      callbacks.onFreeAsk();
      callbacks.onOpenNormal();
    },
  },
  {
    id: "web",
    label: "Web",
    icon: Globe,
    accent: "#4ade80",
    bg: "rgba(74, 222, 128, 0.18)",
    onClick: (callbacks: HelixLauncherProps) => {
      callbacks.onSearchWeb();
      callbacks.onOpenNormal();
    },
  },
  {
    id: "screen",
    label: "Ler tela",
    icon: Scan,
    accent: "#facc15",
    bg: "rgba(250, 204, 21, 0.18)",
    onClick: (callbacks: HelixLauncherProps) => {
      callbacks.onReadScreen();
      callbacks.onOpenNormal();
    },
  },
  {
    id: "open",
    label: "Abrir",
    icon: Clipboard,
    accent: "#a78bfa",
    bg: "rgba(167, 139, 250, 0.18)",
    onClick: (callbacks: HelixLauncherProps) => callbacks.onOpenNormal(),
  },
];

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
      action.onClick(props);
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
            "radial-gradient(circle, rgba(26, 22, 46, 0.96) 0%, rgba(18, 16, 36, 0.9) 55%, rgba(10, 8, 22, 0.78) 100%)",
          backdropFilter: "blur(12px) saturate(120%)",
          WebkitBackdropFilter: "blur(12px) saturate(120%)",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.08), 0 20px 44px rgba(0,0,0,0.4), 0 0 40px rgba(196,153,244,0.12)",
        }}
      />

      {menuOpen && (
        <>
          {/* Decorative orbital rings */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none animate-spin-slow"
            viewBox={`0 0 ${MENU_SIZE} ${MENU_SIZE}`}
            aria-hidden="true"
          >
            <circle
              cx={MENU_SIZE / 2}
              cy={MENU_SIZE / 2}
              r={ORBIT_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
              strokeDasharray="6 10"
            />
            <circle
              cx={MENU_SIZE / 2}
              cy={MENU_SIZE / 2}
              r={ORBIT_RADIUS - 28}
              fill="none"
              stroke="rgba(196,153,244,0.18)"
              strokeWidth="1"
              strokeDasharray="4 14"
            />
          </svg>

          {/* Subtle distant stars */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
            {[
              { id: "a", size: 2, left: 22, top: 18, delay: 0, opacity: 0.5 },
              { id: "b", size: 1, left: 72, top: 24, delay: 0.4, opacity: 0.4 },
              { id: "c", size: 2, left: 55, top: 12, delay: 0.8, opacity: 0.55 },
              { id: "d", size: 1, left: 34, top: 68, delay: 1.2, opacity: 0.45 },
              { id: "e", size: 1, left: 80, top: 58, delay: 1.6, opacity: 0.38 },
              { id: "f", size: 2, left: 15, top: 52, delay: 2, opacity: 0.55 },
              { id: "g", size: 1, left: 62, top: 78, delay: 2.4, opacity: 0.42 },
              { id: "h", size: 1, left: 44, top: 86, delay: 2.8, opacity: 0.48 },
              { id: "i", size: 1, left: 26, top: 88, delay: 3.2, opacity: 0.4 },
              { id: "j", size: 2, left: 85, top: 30, delay: 3.6, opacity: 0.52 },
            ].map((star) => (
              <div
                key={star.id}
                className="absolute rounded-full bg-white/70 animate-twinkle"
                style={{
                  width: star.size,
                  height: star.size,
                  left: `${star.left}%`,
                  top: `${star.top}%`,
                  animationDelay: `${star.delay}s`,
                  opacity: star.opacity,
                }}
              />
            ))}
          </div>

          {/* Orbital selection ray */}
          {activeAction && (
            <div
              className="radial-ray absolute top-1/2 left-1/2 pointer-events-none"
              style={{
                ["--accent-color" as string]: activeAction.accent,
                width: ORBIT_RADIUS - RAY_OFFSET,
                height: 2.5,
                borderRadius: 9999,
                background: `linear-gradient(90deg, var(--accent-color), transparent)`,
                transform: `translate(0, -50%) rotate(${activeAngle}deg)`,
                transformOrigin: "0 50%",
                opacity: 0.9,
                filter: "drop-shadow(0 0 3px var(--accent-color))",
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
                aria-label={action.label}
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
                  className={`radial-item flex flex-col items-center gap-3 ${
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
                    className="relative flex items-center justify-center rounded-full transition-all duration-300"
                    style={{
                      width: 58,
                      height: 58,
                      background: action.bg,
                      border: isSelected
                        ? "2px solid var(--accent-color)"
                        : "1.5px solid color-mix(in srgb, var(--accent-color) 33%, transparent)",
                      boxShadow: isSelected
                        ? `0 0 26px var(--accent-color), inset 0 0 12px color-mix(in srgb, var(--accent-color) 35%, transparent)`
                        : `0 10px 28px rgba(0,0,0,0.35), 0 0 14px color-mix(in srgb, var(--accent-color) 15%, transparent)`,
                    }}
                  >
                    {isSelected && (
                      <div
                        className="radial-halo absolute -inset-1.5 rounded-full"
                        style={{
                          border: "2px solid var(--accent-color)",
                          opacity: 0.9,
                        }}
                      />
                    )}
                    <action.icon
                      className="transition-transform duration-300"
                      size={22}
                      style={{
                        color: "var(--accent-color)",
                        transform: isSelected ? "scale(1.08)" : "scale(1)",
                        filter: isSelected ? "drop-shadow(0 0 6px var(--accent-color))" : "none",
                      }}
                    />
                  </div>
                  <span
                    className="text-[13px] font-semibold tracking-wide text-center"
                    style={{
                      color: "var(--accent-color)",
                      lineHeight: 1.2,
                      maxWidth: 92,
                      textShadow: isSelected ? "0 0 12px var(--accent-color)" : "none",
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

          {/* Selection halo and ray are the only selection indicators */}
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
        className={`relative z-30 flex items-center justify-center rounded-full cursor-pointer transition-transform duration-300 bg-transparent border-0 p-0 focus:outline-none hover:scale-110 ${
          menuOpen ? "scale-110" : ""
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
          <Pet size={menuOpen ? 84 : petSize} glow={menuOpen} />
        </div>
      </button>
    </div>
  );
}
