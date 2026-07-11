import {
  Clipboard,
  Code,
  Eye,
  FileText,
  Globe,
  Layout,
  Monitor,
  Plus,
  RefreshCw,
  ShieldAlert,
  Type,
  X,
} from "lucide-react";
import type { ComponentType, MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ContextChipItem } from "../../surfaces/helix/hooks/useContextChips";

export type ContextSource = "clipboard" | "screen" | "active_app" | "file" | "connector";

export interface ContextItem {
  id: string;
  source: ContextSource;
  label: string;
  preview: string;
  enabled: boolean;
  sensitive: boolean;
  mock?: boolean;
}

interface UnifiedContextBarProps {
  items: ContextItem[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onReload?: () => void;
  onShowPreview?: (id: string) => void;
  clipboardActions?: ContextChipItem[];
  onClipboardAction?: (chip: ContextChipItem) => void;
}

interface LegacyContextBarProps {
  text: string;
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onReload: () => void;
  clipboardActions?: ContextChipItem[];
  onClipboardAction?: (chip: ContextChipItem) => void;
}

type ContextBarProps = UnifiedContextBarProps | LegacyContextBarProps;

const SOURCE_ICONS: Record<ContextSource, ComponentType<{ className?: string }>> = {
  clipboard: Clipboard,
  screen: Monitor,
  active_app: Layout,
  file: FileText,
  connector: Globe,
};

function detectContentIcon(text: string): ComponentType<{ className?: string }> {
  const trimmed = text.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return Globe;
  }
  if (
    trimmed.includes("{") ||
    trimmed.includes("function") ||
    trimmed.includes("class ") ||
    trimmed.includes("import ")
  ) {
    return Code;
  }
  if (trimmed.length > 120) {
    return FileText;
  }
  return Type;
}

function isUnified(props: ContextBarProps): props is UnifiedContextBarProps {
  return "items" in props;
}

function ContextItemRow({
  item,
  onToggle,
  onRemove,
  onReload,
  onShowPreview,
}: {
  item: ContextItem;
  onToggle: () => void;
  onRemove: () => void;
  onReload?: () => void;
  onShowPreview?: () => void;
}) {
  const { t } = useTranslation("helix");
  const SourceIcon = SOURCE_ICONS[item.source];
  const ContentIcon = item.source === "clipboard" ? detectContentIcon(item.preview) : SourceIcon;

  return (
    <div
      className={`group flex h-7 min-w-0 items-center gap-1.5 rounded-full border px-2 pr-1.5 transition-all ${
        item.enabled
          ? "border-signal bg-signal text-ink shadow-[0_0_0_1px_rgba(196,153,244,0.25)]"
          : "border-line bg-white/[0.03] text-mute hover:border-signal/30 hover:bg-white/[0.06] hover:text-fg"
      }`}
      title={item.preview}
    >
      <ContentIcon className={`h-3.5 w-3.5 shrink-0 ${item.enabled ? "text-ink" : "text-faint"}`} />
      <span className={`truncate text-[10px] font-semibold ${item.enabled ? "text-ink" : "text-mute"}`}>
        {item.label}
      </span>
      {item.sensitive && !item.mock && !item.enabled && (
        <span title={t("contextBar.sensitive")}>
          <ShieldAlert className="h-3 w-3 shrink-0 text-warn" />
        </span>
      )}
      {item.mock && (
        <span className="shrink-0 rounded-md bg-white/[0.08] px-1 py-0 text-[7px] font-medium uppercase tracking-wide text-faint">
          {t("contextBar.soon")}
        </span>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        {!item.mock && item.source === "clipboard" && item.enabled && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShowPreview?.();
              }}
              className="rounded-full p-1 text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
              title={t("contextBar.preview")}
              aria-label={t("contextBar.preview")}
            >
              <Eye className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReload?.();
              }}
              className="rounded-full p-1 text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
              title={t("contextBar.reloadClipboard")}
              aria-label={t("contextBar.reloadClipboard")}
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </>
        )}
        {!item.mock && item.sensitive && !item.enabled ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-mute transition-colors hover:bg-white/[0.12] hover:text-fg"
          >
            {t("contextBar.allow")}
          </button>
        ) : !item.mock ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
              item.enabled
                ? "bg-ink/10 text-ink hover:bg-ink/20"
                : "bg-white/[0.06] text-mute hover:bg-white/[0.12] hover:text-fg"
            }`}
            title={item.enabled ? t("contextBar.disable") : t("contextBar.enable")}
          >
            {item.enabled ? t("contextBar.included") : t("contextBar.include")}
          </button>
        ) : null}
        {!item.mock && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="hidden rounded-full p-1 text-ink/70 transition-colors hover:bg-bad/10 hover:text-bad group-hover:flex"
            title={t("contextBar.remove")}
            aria-label={t("contextBar.remove")}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function LegacyClipboardBar(props: LegacyContextBarProps) {
  const { t } = useTranslation("helix");
  const hasText = props.text.trim().length > 0;
  const Icon = detectContentIcon(props.text);

  if (!hasText) {
    return (
      <div className="flex items-center gap-2 px-1 text-[10px] text-faint select-none">
        <Clipboard className="h-3 w-3" />
        <span>{t("contextBar.copyTextHint")}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-1.5 transition-colors ${
        props.enabled ? "bg-signal/[0.04] border-signal/20" : "bg-transparent border-line"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${props.enabled ? "text-signal" : "text-faint"}`} />
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className={`text-[10px] font-medium ${props.enabled ? "text-signal" : "text-faint"}`}>
            {t("contextBar.clipboard")}
          </span>
          <span className="text-[10px] text-faint font-mono">
            {props.text.length} {t("contextBar.characters")}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={props.onReload}
            className="rounded-md p-1 text-faint transition-colors hover:bg-white/5 hover:text-fg"
            title={t("contextBar.reloadClipboard")}
            aria-label={t("contextBar.reloadClipboard")}
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          {props.enabled ? (
            <button
              type="button"
              onClick={props.onDisable}
              className="rounded-md bg-signal/10 px-2 py-1 text-[10px] font-medium text-signal transition-colors hover:bg-signal/20"
              title={t("contextBar.removeClipboard")}
            >
              {t("contextBar.included")}
            </button>
          ) : (
            <button
              type="button"
              onClick={props.onEnable}
              className="rounded-md bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-mute transition-colors hover:bg-white/[0.08] hover:text-fg"
              title={t("contextBar.includeClipboard")}
            >
              {t("contextBar.include")}
            </button>
          )}
        </div>
      </div>

      {props.clipboardActions && props.clipboardActions.length > 0 && props.onClipboardAction && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-line/40 pt-1.5">
          {props.clipboardActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => props.onClipboardAction?.(action)}
                className="flex items-center gap-1 rounded-full border border-line bg-white/[0.03] px-2 py-1 text-[10px] text-mute transition-colors hover:border-signal/30 hover:bg-white/[0.06] hover:text-fg"
                title={action.prompt}
              >
                <ActionIcon className={`h-3 w-3 ${action.accent}`} />
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ContextBar(props: ContextBarProps) {
  const { t } = useTranslation("helix");

  if (!isUnified(props)) {
    return <LegacyClipboardBar {...props} />;
  }

  const { items, onToggle, onRemove, onReload, onShowPreview } = props;

  const handleAddMock = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-line border-dashed p-2">
          <div className="flex items-center gap-2 text-[10px] text-faint select-none">
            <Clipboard className="h-3 w-3" />
            <span>{t("contextBar.emptyHint")}</span>
          </div>
          <button
            type="button"
            onClick={handleAddMock}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-mute transition-colors hover:bg-white/[0.05] hover:text-fg"
            title={t("contextBar.comingSoon")}
          >
            <Plus className="h-3 w-3" />
            {t("contextBar.add")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {items.map((item) => (
            <ContextItemRow
              key={item.id}
              item={item}
              onToggle={() => onToggle(item.id)}
              onRemove={() => onRemove(item.id)}
              onReload={item.source === "clipboard" ? onReload : undefined}
              onShowPreview={() => onShowPreview?.(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
