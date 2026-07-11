import { Clock, History, MessageSquare, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAgent } from "../../lib/rpc";

interface RecentConversationsProps {
  limit?: number;
  onSelect?: (id: string) => void;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

export function formatRelativeDate(date: Date, language: string): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const timestamp = date.getTime();

  if (timestamp >= startOfToday) {
    return new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  if (timestamp >= startOfYesterday) {
    return "Ontem";
  }
  return new Intl.DateTimeFormat(language, { day: "2-digit", month: "short" }).format(date);
}

export function RecentConversations({
  limit = 5,
  onSelect,
  showViewAll,
  onViewAll,
}: RecentConversationsProps) {
  const { t, i18n } = useTranslation("helix");
  const [conversations, setConversations] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = await getAgent();
      const data = await api.listConversations({ limit });
      setConversations(data);
    } catch (err) {
      console.error("Failed to load recent conversations:", err);
      setError(t("helix:recentConversations.loadError"));
    } finally {
      setLoading(false);
    }
  }, [limit, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = (id: string) => {
    setSelectingId(id);
    try {
      onSelect?.(id);
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-mute uppercase tracking-wider">
          <History className="h-3 w-3 text-signal" />
          {t("helix:recentConversations.title")}
        </div>
        <div className="flex items-center gap-1.5">
          {showViewAll && (
            <button
              type="button"
              onClick={() => onViewAll?.()}
              className="text-[10px] text-faint transition-colors hover:text-fg"
            >
              {t("helix:recentConversations.viewAll")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="text-faint hover:text-fg transition-colors"
            title={t("helix:recentConversations.refresh")}
            aria-label={t("helix:recentConversations.refresh")}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <div className="text-[10px] text-bad">{error}</div>}

      {conversations.length === 0 && !loading ? (
        <div className="flex items-center gap-2 text-[10px] text-faint">
          <Clock className="h-3 w-3" />
          <span>{t("helix:recentConversations.empty")}</span>
        </div>
      ) : (
        <div className="flex flex-col">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => handleSelect(conversation.id)}
              disabled={selectingId === conversation.id}
              className="group flex items-center gap-2 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white/[0.03] disabled:opacity-60"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line/70 bg-ink/30 text-faint transition-colors group-hover:border-signal/25 group-hover:text-signal">
                {selectingId === conversation.id ? (
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <MessageSquare className="h-2.5 w-2.5" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-fg">{conversation.title}</span>
              <span className="shrink-0 text-[10px] text-faint">
                {formatRelativeDate(new Date(conversation.updatedAt), i18n.language)}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
