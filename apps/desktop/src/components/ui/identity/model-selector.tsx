import { Bot, Check, ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ModelSelectorOption {
  value: string;
  label: string;
}

interface ModelSelectorProps {
  provider: string;
  providerOptions: ModelSelectorOption[];
  onProviderChange: (value: string) => void;
  model: string;
  modelOptions: ModelSelectorOption[] | null;
  onModelChange: (value: string) => void;
  displayLabel: string;
  needsApiKey?: boolean;
  disabled?: boolean;
}

const MARGIN = 8;

export function ModelSelector({
  provider,
  providerOptions,
  onProviderChange,
  model,
  modelOptions,
  onModelChange,
  displayLabel,
  needsApiKey,
  disabled,
}: ModelSelectorProps) {
  const { t } = useTranslation("helix");
  const [open, setOpen] = useState(false);
  const [customModel, setCustomModel] = useState(model);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popupRef.current) return;

    const anchor = triggerRef.current;
    const popup = popupRef.current;
    const rect = anchor.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const popupHeight = popupRect.height;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceAbove = rect.top - MARGIN;
    const spaceBelow = viewportHeight - rect.bottom - MARGIN;

    let top = rect.top - MARGIN - popupHeight;
    if (popupHeight > spaceAbove && spaceBelow > spaceAbove) {
      top = rect.bottom + MARGIN;
    }
    top = Math.max(MARGIN, Math.min(top, viewportHeight - popupHeight - MARGIN));

    let left = rect.left;
    left = Math.max(MARGIN, Math.min(left, viewportWidth - popupRect.width - MARGIN));

    setPosition({ top, left, width: Math.max(rect.width, popupRect.width) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleProviderSelect = (value: string) => {
    onProviderChange(value);
  };

  const handleModelSelect = (value: string) => {
    onModelChange(value);
  };

  const handleCustomModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomModel(value);
    onModelChange(value);
  };

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="flex h-7 items-center gap-1.5 rounded-full border border-line-strong bg-ink/50 px-3 text-[11px] text-fg transition-colors hover:border-signal/40 hover:text-signal disabled:opacity-50"
        aria-label={t("helix:providerModelSelect.modelLabel")}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bot className="h-3 w-3 text-signal" />
        <span className="truncate max-w-[180px]">{displayLabel}</span>
        <ChevronDown className={`h-3 w-3 text-mute transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={popupRef}
          className="fixed z-50 min-w-[220px] rounded-xl border border-line-strong bg-ink/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl animate-popup-enter"
          style={{ top: position.top, left: position.left, width: position.width }}
          role="dialog"
          aria-label={t("helix:providerModelSelect.modelLabel")}
        >
          <div className="max-h-[min(420px,70vh)] overflow-y-auto">
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-mute">
              {t("helix:providerModelSelect.providerLabel")}
            </div>
            {providerOptions.map((opt) => {
              const isSelected = opt.value === provider;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleProviderSelect(opt.value)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                    isSelected ? "bg-signal/10 text-signal" : "text-fg hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="truncate flex-1">{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 animate-check-pop" />}
                </button>
              );
            })}

            <div className="my-1.5 h-px bg-line/60" />

            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-mute">
              {t("helix:providerModelSelect.modelLabel")}
            </div>
            {modelOptions ? (
              modelOptions.map((opt) => {
                const isSelected = opt.value === model;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleModelSelect(opt.value)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                      isSelected ? "bg-signal/10 text-signal" : "text-fg hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="truncate flex-1">{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 animate-check-pop" />}
                  </button>
                );
              })
            ) : (
              <div className="px-2.5 py-1.5">
                <input
                  type="text"
                  value={customModel}
                  onChange={handleCustomModelChange}
                  placeholder={t("helix:providerModelSelect.modelPlaceholder")}
                  className="h-7 w-full rounded-md border border-line bg-ink/40 px-2 text-[11px] text-fg placeholder:text-faint focus:border-signal/50 focus:outline-none"
                  aria-label={t("helix:providerModelSelect.modelLabel")}
                />
              </div>
            )}

            {needsApiKey && (
              <div className="mt-1.5 border-t border-line/60 px-2.5 pt-1.5">
                <span className="text-[9px] text-bad">{t("helix:composer.modelNeedsKey")}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
