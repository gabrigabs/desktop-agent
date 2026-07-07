import { Clock, Layers, MessageSquarePlus, Settings, Sparkles, Square } from "lucide-react";
import { Button } from "./button";
import { Separator } from "./separator";

type NavMode = "command" | "history" | "prompts" | "connectors" | "settings";

interface HelixSidebarProps {
  mode: NavMode;
  onChangeMode: (mode: NavMode) => void;
  onNewTask: () => void;
  onToggleExpand: () => void;
}

const items: { id: NavMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "command", label: "Nova conversa", icon: MessageSquarePlus },
  { id: "history", label: "Histórico", icon: Clock },
  { id: "prompts", label: "Perfis", icon: Sparkles },
  { id: "connectors", label: "Conectores", icon: Layers },
  { id: "settings", label: "Config", icon: Settings },
];

export function HelixSidebar({ mode, onChangeMode, onNewTask, onToggleExpand }: HelixSidebarProps) {
  return (
    <aside className="w-[200px] h-full border-r border-line bg-white/[0.01] p-4 flex flex-col gap-2 shrink-0">
      <div className="text-[10px] text-faint font-mono uppercase tracking-wider mb-2">Menu</div>
      {items.map((item) => {
        const Icon = item.icon;
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.id === "command") {
                onNewTask();
              }
              onChangeMode(item.id);
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

      <div className="mt-auto flex flex-col gap-2">
        <Separator />
        <Button variant="secondary" size="sm" onClick={onToggleExpand}>
          <Square className="w-3.5 h-3.5" />
          Modo normal
        </Button>
      </div>
    </aside>
  );
}
