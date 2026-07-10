import { MessageSquare, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAgent } from "../../lib/rpc";
import { useAgentStore } from "../../stores/agent";

type HistoryListProps = {
  onSelectConversation?: () => void;
};

export function HistoryList({ onSelectConversation }: HistoryListProps) {
  const { t } = useTranslation("helix");
  const [conversations, setConversations] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const api = await getAgent();
        const data = await api.listConversations({ limit: 30 });
        setConversations(data);
      } catch (err) {
        console.error("Failed to load conversations:", err);
        setError(t("helix:historyList.loadError"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t]);

  const handleSelect = async (id: string) => {
    setSelectingId(id);
    setError(null);
    try {
      const api = await getAgent();
      const turns = await api.listTurns({ conversationId: id });
      const store = useAgentStore.getState();
      const lastAssistant = [...turns].reverse().find((turn) => turn.role === "assistant");
      const result = lastAssistant?.blocks
        .filter((block) => block.type === "text")
        .map((block) => (block.type === "text" ? block.content : ""))
        .join("");

      store.setCurrentConversationId(id);
      store.setMessages(turns);
      store.setResult(result || null);
      store.setStreaming(false);
      store.setError(null);
      store.setWorkflowRun(null);
      onSelectConversation?.();
    } catch (err) {
      console.error("Failed to load conversation turns:", err);
      setError(t("helix:historyList.openError"));
    } finally {
      setSelectingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-4 h-4 text-signal animate-spin" />
        <span className="text-mute text-xs ml-2">{t("helix:historyList.loading")}</span>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-line rounded-xl bg-white/[0.015]">
        <MessageSquare className="w-5 h-5 text-faint mx-auto mb-2" />
        <p className="text-mute text-xs font-semibold">{t("helix:historyList.empty")}</p>
        <p className="text-faint text-[11px] mt-1">{t("helix:historyList.emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[10px] tracking-wide text-mute font-medium mb-1">
        {t("helix:historyList.recentConversations")}
      </div>
      {error && (
        <div className="rounded-lg border border-bad/20 bg-bad/8 px-3 py-2 text-xs text-bad">{error}</div>
      )}
      <div className="flex flex-col gap-2">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            onClick={() => void handleSelect(conversation.id)}
            disabled={selectingId !== null}
            className="text-left bg-white/[0.025] border border-line hover:border-line-strong rounded-xl p-3 hover:bg-white/[0.045] transition-colors disabled:opacity-60"
          >
            <div className="flex items-center justify-between mb-1.5 text-[10px]">
              <span className="font-semibold text-fg truncate pr-3">{conversation.title}</span>
              <span className="text-faint shrink-0 flex items-center gap-1.5">
                {new Date(conversation.updatedAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {selectingId === conversation.id && <RefreshCw className="w-3 h-3 animate-spin" />}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
