import { Clipboard, Globe, MessageSquarePlus, Scan, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Pet } from "./pet";

interface HelixLauncherProps {
  petSize: number;
  onOpenNormal: () => void;
  onNewTask: () => void;
  onFreeAsk: () => void;
  onSearchWeb: () => void;
  onReadScreen: () => void;
}

export function HelixLauncher({
  petSize,
  onOpenNormal,
  onNewTask,
  onFreeAsk,
  onSearchWeb,
  onReadScreen,
}: HelixLauncherProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const clickCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const handleClick = () => {
    clickCount.current += 1;
    if (clickCount.current === 1) {
      timerRef.current = setTimeout(() => {
        clickCount.current = 0;
        setMenuOpen(true);
      }, 220);
    } else if (clickCount.current === 2) {
      if (timerRef.current) clearTimeout(timerRef.current);
      clickCount.current = 0;
      setMenuOpen(false);
      onOpenNormal();
    }
  };

  const actions = [
    {
      id: "new",
      label: "Nova conversa",
      icon: MessageSquarePlus,
      onClick: () => {
        onNewTask();
        onOpenNormal();
      },
    },
    {
      id: "ask",
      label: "Pergunta livre",
      icon: Search,
      onClick: () => {
        onFreeAsk();
        onOpenNormal();
      },
    },
    {
      id: "web",
      label: "Pesquisar web",
      icon: Globe,
      onClick: () => {
        onSearchWeb();
        onOpenNormal();
      },
    },
    {
      id: "screen",
      label: "Ler tela",
      icon: Scan,
      onClick: () => {
        onReadScreen();
        onOpenNormal();
      },
    },
    { id: "open", label: "Abrir normal", icon: Clipboard, onClick: onOpenNormal },
  ];

  return (
    <div ref={containerRef} className="relative flex items-center justify-center w-full h-full">
      <button
        type="button"
        onClick={handleClick}
        className="w-full h-full flex items-center justify-center group focus:outline-none cursor-pointer"
        aria-label="Abrir Helix"
        title="Abrir Helix"
      >
        <div className="transition-transform duration-200 group-hover:scale-[1.04]">
          <Pet size={petSize} />
        </div>
      </button>

      {menuOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 p-1.5 rounded-xl agent-shell border border-line shadow-xl flex flex-col gap-0.5 z-50">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  action.onClick();
                }}
                className="w-full h-8 px-2.5 rounded-lg text-xs text-fg hover:bg-white/[0.06] flex items-center gap-2 transition-colors text-left"
              >
                <Icon className="w-3.5 h-3.5 text-mute" />
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
