import { useState } from "react";

type ResultPreviewProps = {
  content: string;
  onCopy: () => void;
};

export function ResultPreview({ content, onCopy }: ResultPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2 flex flex-col gap-2 font-mono">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
          [ OUTPUT RESULT ]
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={`px-2.5 py-1 text-[10px] font-bold rounded border transition-all duration-150 active:scale-95 cursor-pointer ${
            copied
              ? "bg-emerald-950/30 border-emerald-800 text-emerald-400"
              : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/80"
          }`}
        >
          {copied ? "✓ COPIADO" : "⚙ COPIAR"}
        </button>
      </div>
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-3.5 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar select-text selection:bg-zinc-800">
        {content}
      </div>
    </div>
  );
}
