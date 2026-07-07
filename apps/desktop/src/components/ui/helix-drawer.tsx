import { Clock, Layers, MessageSquarePlus, Settings, Sparkles, X } from "lucide-react";

type NavMode = "command" | "history" | "prompts" | "connectors" | "settings";

interface HelixDrawerProps {
  open: boolean;
  mode: NavMode;
  onClose: () => void;
  onChangeMode: (mode: NavMode) => void;
  onNewTask: () => void;
}

const items: { id: NavMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "command", label: "Nova conversa", icon: MessageSquarePlus },
  { id: "history", label: "Histórico", icon: Clock },
  { id: "prompts", label: "Perfis", icon: Sparkles },
  { id: "connectors", label: "Conectores", icon: Layers },
  { id: "settings", label: "Config", icon: Settings },
];

export function HelixDrawer({ open, mode, onClose, onChangeMode, onNewTask }: HelixDrawerProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 z-30"
        onClick={onClose}
        aria-label="Fechar menu"
      />
      <div className="absolute top-11 left-0 bottom-0 w-[220px] z-40 agent-shell border-r border-line p-4 flex flex-col gap-2 animate-in slide-in-from-left duration-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-faint font-mono uppercase tracking-wider">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-faint hover:text-fg hover:bg-white/5 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {items.map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "command") onNewTask();
                onChangeMode(item.id);
                onClose();
              }}
              className={`h-9 w-full rounded-lg px-3 text-left text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                active
                  ? "bg-white/8 text-fg border border-line-strong"
                  : "text-mute hover:text-fg hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
