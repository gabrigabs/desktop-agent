import type { Turn } from "@desktop-agent/shared";
import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { QueryBubble } from "../composer/QueryBubble";
import { ApprovalCard, type ApprovalViewModel } from "../response/ApprovalCard";
import { ResponseBubble } from "../response/ResponseBubble";

interface ChatViewProps {
  turns: Turn[];
  streaming: boolean;
  onEditPrompt?: (text: string) => void;
  onCopyResponse?: (text: string) => void;
  onRegenerate?: () => void;
  onPromoteToMemory?: (turn: Turn) => Promise<string | null>;
  onToastSuccess?: (message: string, duration?: number) => void;
  onToastError?: (message: string, duration?: number) => void;
  approval?: ApprovalViewModel;
  onApproval?: (approved: boolean) => void;
}

export function ChatView({
  turns,
  streaming,
  onEditPrompt,
  onCopyResponse,
  onRegenerate,
  onPromoteToMemory,
  onToastSuccess,
  onToastError,
  approval,
  onApproval,
}: ChatViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isNearBottomRef.current = nearBottom;
    setShowJump(!nearBottom);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll on new turns/streaming
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [turns, streaming]);

  const scrollToBottom = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    isNearBottomRef.current = true;
    setShowJump(false);
  };

  const visibleTurns = turns.filter((t) => t.role !== "system");

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-3 space-y-4 mx-auto max-w-[var(--composer-expanded-width)] w-full"
      >
        {visibleTurns.map((turn, i) => {
          const isLastAssistant = streaming && turn.role === "assistant" && i === visibleTurns.length - 1;

          if (turn.role === "user") {
            return (
              <QueryBubble
                key={turn.id}
                turn={turn}
                onEditPrompt={onEditPrompt}
                onToastSuccess={onToastSuccess}
                onToastError={onToastError}
              />
            );
          }

          return (
            <ResponseBubble
              key={turn.id}
              turn={turn}
              onCopyText={onCopyResponse}
              onRegenerate={isLastAssistant ? undefined : onRegenerate}
              onPromoteToMemory={onPromoteToMemory}
              onToastSuccess={onToastSuccess}
              onToastError={onToastError}
            />
          );
        })}
        {approval && onApproval && <ApprovalCard approval={approval} onDecision={onApproval} />}
        <div className="h-1" />
      </div>

      {showJump && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 h-8 px-3 rounded-full bg-glass border border-line-strong text-[10px] font-semibold text-mute hover:text-fg shadow-lg transition-all cursor-pointer flex items-center gap-1.5 z-10 animate-status-enter hover:scale-105 active:scale-95"
        >
          <ArrowDown className="w-3 h-3" />
          Ir para o final
        </button>
      )}
    </div>
  );
}
