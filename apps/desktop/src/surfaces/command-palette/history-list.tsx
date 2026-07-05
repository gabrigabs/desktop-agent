import { useEffect, useState } from "react";
import { getAgent } from "../../lib/rpc";
import { useAgentStore } from "../../stores/agent";

export function HistoryList() {
  const { history, setHistory } = useAgentStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const api = await getAgent();
        const data = (await api.getHistory({ limit: 30 })) as Array<{
          id: string;
          timestamp: string;
          tool_name: string;
          input_preview: string;
          output_preview: string;
        }>;
        setHistory(data);
      } catch {
        // History load failure is non-blocking
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-4 h-4 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
        <span className="text-zinc-500 text-xs ml-2">Carregando histórico...</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-zinc-900 rounded-xl">
        <p className="text-zinc-500 text-xs font-semibold">Nenhuma conversa ainda</p>
        <p className="text-zinc-700 text-[11px] mt-1">
          Os resultados salvos aparecem aqui depois da primeira execução.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
        Histórico recente
      </div>
      <div className="flex flex-col gap-2">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="bg-zinc-950/70 border border-zinc-900 hover:border-zinc-800/80 rounded-xl p-3 hover:bg-zinc-900/40 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-1.5 text-[10px]">
              <span className="font-bold text-indigo-400 bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-900/30">
                {entry.tool_name}
              </span>
              <span className="text-zinc-600">
                {new Date(entry.timestamp).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate italic">"{entry.input_preview}"</p>
            {entry.output_preview && (
              <p className="text-[11px] text-zinc-600 truncate mt-1">Resultado: {entry.output_preview}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
