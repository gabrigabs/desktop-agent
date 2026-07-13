import type { MemoryFact } from "@desktop-agent/shared";
import { Archive, Brain, Check, FileUp, Loader2, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";

type Props = {
  workspaceId: string;
  memoryEnabled: boolean;
  facts: MemoryFact[];
  onAdd: (workspaceId: string, content: string) => Promise<string | null>;
  onAddFiles: (workspaceId: string) => Promise<number>;
  onUpdate: (id: string, updates: { content?: string; status?: "active" | "archived" }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function WorkspaceMemoryPanel({
  workspaceId,
  memoryEnabled,
  facts,
  onAdd,
  onAddFiles,
  onUpdate,
  onDelete,
}: Props) {
  const { t } = useTranslation("helix");
  const [newFact, setNewFact] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleAdd = async () => {
    if (!newFact.trim()) return;
    const id = await onAdd(workspaceId, newFact.trim());
    if (id) setNewFact("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    await onUpdate(editingId, { content: editContent.trim() });
    setEditingId(null);
    setEditContent("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("helix:workspace.deleteFactConfirm"))) return;
    await onDelete(id);
  };

  const handleAddFiles = async () => {
    setUploading(true);
    await onAddFiles(workspaceId);
    setUploading(false);
  };

  const activeFacts = facts.filter((f) => f.status === "active");
  const archivedFacts = facts.filter((f) => f.status === "archived");

  return (
    <section className="rounded-xl border border-line bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-signal" />
          <h3 className="text-sm font-semibold text-fg">{t("helix:workspace.memory")}</h3>
          {memoryEnabled ? (
            <span className="text-[10px] text-good bg-good/10 px-1.5 py-0.5 rounded font-medium">
              {t("helix:workspace.memoryActive")}
            </span>
          ) : (
            <span className="text-[10px] text-faint bg-white/[0.04] px-1.5 py-0.5 rounded">
              {t("helix:workspace.memoryDisabled")}
            </span>
          )}
        </div>
        <span className="text-xs text-faint">
          {t("helix:workspace.factsCount", { count: activeFacts.length })}
        </span>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 rounded-lg border border-line bg-ink/30 px-3 py-2 text-sm text-fg placeholder:text-faint transition-colors focus:border-signal/40 focus:bg-ink/50 outline-none"
          placeholder={t("helix:workspace.addMemoryPlaceholder")}
          value={newFact}
          onChange={(e) => setNewFact(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleAdd();
            }
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAdd}
          disabled={!newFact.trim()}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <button
        type="button"
        onClick={handleAddFiles}
        disabled={uploading}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line py-2.5 text-xs text-faint transition-colors hover:border-line-strong hover:text-mute disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
        {uploading ? t("helix:workspace.uploading") : t("helix:workspace.addFiles")}
      </button>

      {activeFacts.length === 0 && archivedFacts.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Brain className="h-8 w-8 text-faint/40 mb-2" />
          <p className="text-xs text-faint">{t("helix:workspace.noMemory")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {activeFacts.map((fact) => (
            <div
              key={fact.id}
              className="group rounded-lg border border-line bg-white/[0.03] p-3 flex items-start gap-2 transition-colors hover:border-line-strong helix-view-enter"
            >
              {editingId === fact.id ? (
                <div className="flex-1 flex flex-col gap-2">
                  <textarea
                    className="w-full rounded border border-line bg-ink/30 px-2 py-1.5 text-sm text-fg resize-none outline-none focus:border-signal/40"
                    rows={2}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="gap-1">
                      <X className="h-3 w-3" />
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSaveEdit} className="gap-1">
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg">{fact.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-faint">
                        {fact.origin === "assistant"
                          ? t("helix:workspace.factOriginAssistant")
                          : t("helix:workspace.factOriginManual")}
                      </span>
                      <span className="text-[10px] text-faint">
                        {new Date(fact.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      type="button"
                      className="p-1 rounded text-faint hover:text-fg hover:bg-white/[0.06] transition-colors"
                      onClick={() => {
                        setEditingId(fact.id);
                        setEditContent(fact.content);
                      }}
                      title={t("helix:workspace.edit")}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded text-faint hover:text-warn hover:bg-white/[0.06] transition-colors"
                      onClick={() => onUpdate(fact.id, { status: "archived" })}
                      title={t("helix:workspace.archive")}
                    >
                      <Archive className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded text-faint hover:text-bad hover:bg-white/[0.06] transition-colors"
                      onClick={() => void handleDelete(fact.id)}
                      title={t("helix:workspace.delete")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {archivedFacts.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-faint cursor-pointer hover:text-mute transition-colors select-none">
                {t("helix:workspace.archived")} ({archivedFacts.length})
              </summary>
              <div className="flex flex-col gap-1.5 mt-2">
                {archivedFacts.map((fact) => (
                  <div
                    key={fact.id}
                    className="group rounded-lg border border-line bg-white/[0.01] p-2.5 flex items-start gap-2 opacity-60"
                  >
                    <p className="flex-1 text-xs text-mute line-through">{fact.content}</p>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        type="button"
                        className="p-1 rounded text-faint hover:text-good hover:bg-white/[0.06] transition-colors"
                        onClick={() => onUpdate(fact.id, { status: "active" })}
                        title={t("helix:workspace.restore")}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded text-faint hover:text-bad hover:bg-white/[0.06] transition-colors"
                        onClick={() => void handleDelete(fact.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
