import { ArrowUpRight, CalendarDays, Clock3, History, MessageSquare, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAgent } from "../../../lib/rpc";
import { useAgentStore } from "../../../stores/agent";

type HistoryListProps = {
  onSelectConversation?: () => void;
  variant?: "embedded" | "page";
};

export function HistoryList({ onSelectConversation, variant = "embedded" }: HistoryListProps) {
  const { t, i18n } = useTranslation("helix");
  const [conversations, setConversations] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
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
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(i18n.language);
    if (!term) return conversations;
    return conversations.filter((conversation) =>
      conversation.title.toLocaleLowerCase(i18n.language).includes(term),
    );
  }, [conversations, i18n.language, search]);

  const groupedConversations = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const groups = new Map<string, typeof filteredConversations>();

    for (const conversation of filteredConversations) {
      const timestamp = new Date(conversation.updatedAt).getTime();
      const label =
        timestamp >= startOfToday
          ? t("helix:historyList.today")
          : timestamp >= startOfYesterday
            ? t("helix:historyList.yesterday")
            : new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(
                new Date(conversation.updatedAt),
              );
      groups.set(label, [...(groups.get(label) ?? []), conversation]);
    }

    return Array.from(groups.entries());
  }, [filteredConversations, i18n.language, t]);

  const pageHeader =
    variant === "page" ? (
      <header className="grid gap-4 border-b border-line pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.16em] text-faint">
            <History className="h-3 w-3 text-signal" />
            {t("helix:historyList.archive")}
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-fg">
            {t("helix:normalCommandView.historyTitle")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-mute">
            {t("helix:historyList.description")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-faint">
          <MessageSquare className="h-3.5 w-3.5" />
          {t("helix:historyList.conversationCount", { count: conversations.length })}
        </div>
      </header>
    ) : null;

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

      const profileId = turns.find((turn) => turn.profileId)?.profileId ?? null;
      store.setCurrentProfileId(profileId);
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

  if (loading && conversations.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {pageHeader}
        <div className="flex items-center justify-center rounded-2xl border border-line py-12">
          <RefreshCw className="h-4 w-4 animate-spin text-signal" />
          <span className="ml-2 text-xs text-mute">{t("helix:historyList.loading")}</span>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        {pageHeader}
        <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-line bg-white/[0.012] px-6 py-10 text-center">
          <div>
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/[0.025]">
              <MessageSquare className="h-4 w-4 text-faint" />
            </span>
            <p className="mt-3 text-xs font-semibold text-mute">{t("helix:historyList.empty")}</p>
            <p className="mt-1 text-[10px] text-faint">{t("helix:historyList.emptyHint")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {pageHeader}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <label className="relative block">
          <span className="sr-only">{t("helix:historyList.search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("helix:historyList.searchPlaceholder")}
            className="h-10 w-full rounded-xl border border-line bg-white/[0.025] pl-9 pr-3 text-xs text-fg placeholder:text-faint transition-colors focus:border-signal/40"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.025] px-3 text-[11px] font-semibold text-mute transition-colors hover:border-line-strong hover:text-fg disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("helix:historyList.refresh")}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-bad/20 bg-bad/8 px-3 py-2 text-xs text-bad">{error}</div>
      )}

      {groupedConversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center">
          <Search className="mx-auto h-5 w-5 text-faint" />
          <p className="mt-2 text-xs font-semibold text-mute">{t("helix:historyList.noResults")}</p>
          <p className="mt-1 text-[10px] text-faint">{t("helix:historyList.noResultsHint")}</p>
        </div>
      ) : (
        groupedConversations.map(([label, items]) => (
          <section key={label}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <CalendarDays className="h-3 w-3 text-faint" />
              <h3 className="text-[9px] font-mono uppercase tracking-[0.16em] text-faint">{label}</h3>
              <span className="h-px flex-1 bg-line" />
              <span className="text-[9px] font-mono text-faint">{items.length}</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-line bg-white/[0.018]">
              {items.map((conversation, index) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => void handleSelect(conversation.id)}
                  disabled={selectingId !== null}
                  className={`group grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.045] disabled:opacity-60 ${
                    index > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-ink/35 text-faint transition-colors group-hover:border-signal/25 group-hover:text-signal">
                    {selectingId === conversation.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-fg">{conversation.title}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-[9px] text-faint">
                      <Clock3 className="h-3 w-3" />
                      {new Intl.DateTimeFormat(i18n.language, {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(conversation.updatedAt))}
                    </span>
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg" />
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
