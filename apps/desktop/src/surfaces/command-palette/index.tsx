import {
	readText as readClipboard,
	writeText as writeClipboard,
} from "@tauri-apps/plugin-clipboard-manager";
import { useCallback, useEffect, useState } from "react";
import { getAgent } from "../../lib/rpc";
import { useAgentStore } from "../../stores/agent";
import { HistoryList } from "./history-list";
import { ResultPreview } from "./result-preview";

export function CommandPalette() {
	const {
		query,
		result,
		streaming,
		error,
		setQuery,
		setResult,
		setStreaming,
		setError,
		setClipboardText,
		clipboardText,
		reset,
	} = useAgentStore();

	const [mode, setMode] = useState<"command" | "history">("command");

	const handleExecute = useCallback(async () => {
		if (!query.trim()) return;

		setResult(null);
		setError(null);
		setStreaming(true);

		try {
			const api = await getAgent();
			const clipboardContent = await readClipboard();
			setClipboardText(clipboardContent);

			const requestId = crypto.randomUUID();

			if (
				query.toLowerCase().includes("melhor") ||
				query.toLowerCase().includes("rewrite")
			) {
				const execution = await api.execute({
					requestId,
					toolName: "text.rewrite",
					input: { text: clipboardContent, instruction: query },
				});

				const output = execution.result.output as { rewritten: string };
				setResult(output.rewritten);
			} else if (query.toLowerCase().includes("resum")) {
				const execution = await api.execute({
					requestId,
					toolName: "text.summarize",
					input: { text: clipboardContent },
				});

				const output = execution.result.output as { summary: string };
				setResult(output.summary);
			} else if (query.toLowerCase().includes("traduz")) {
				const execution = await api.execute({
					requestId,
					toolName: "text.translate",
					input: { text: clipboardContent, targetLanguage: "inglês" },
				});

				const output = execution.result.output as { translation: string };
				setResult(output.translation);
			} else {
				setError("Comando não reconhecido. Tente: melhore, resuma, traduza.");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Erro ao executar comando");
		} finally {
			setStreaming(false);
		}
	}, [query]);

	const handleCopyResult = useCallback(async () => {
		if (result) {
			await writeClipboard(result);
		}
	}, [result]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Enter" && !streaming) {
				handleExecute();
			}
			if (e.key === "Escape") {
				reset();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleExecute, streaming]);

	return (
		<div className="flex flex-col h-full max-w-2xl mx-auto w-full px-6 pt-16">
			<div className="flex items-center gap-2 mb-6">
				<button
					onClick={() => setMode("command")}
					className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
						mode === "command"
							? "bg-accent/20 text-accent-hover"
							: "text-text-secondary hover:text-text-primary"
					}`}
				>
					Comando
				</button>
				<button
					onClick={() => setMode("history")}
					className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
						mode === "history"
							? "bg-accent/20 text-accent-hover"
							: "text-text-secondary hover:text-text-primary"
					}`}
				>
					Histórico
				</button>
			</div>

			{mode === "command" ? (
				<>
					<div className="relative">
						<input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="melhore isso / resuma / traduza para inglês..."
							className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors text-lg"
							autoFocus
							disabled={streaming}
						/>
						{streaming && (
							<div className="absolute right-3 top-1/2 -translate-y-1/2">
								<div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
							</div>
						)}
					</div>

					{clipboardText && result === null && !streaming && (
						<div className="mt-4 p-3 bg-surface rounded-lg border border-border">
							<p className="text-xs text-text-muted mb-1">
								Clipboard detectado:
							</p>
							<p className="text-sm text-text-secondary truncate">
								{clipboardText.slice(0, 200)}
							</p>
						</div>
					)}

					{error && (
						<div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-300 text-sm">
							{error}
						</div>
					)}

					{result && (
						<ResultPreview content={result} onCopy={handleCopyResult} />
					)}

					<div className="mt-6 text-xs text-text-muted space-y-1">
						<p>
							<kbd className="px-1.5 py-0.5 bg-surface rounded text-text-secondary">
								Enter
							</kbd>{" "}
							executar
						</p>
						<p>
							<kbd className="px-1.5 py-0.5 bg-surface rounded text-text-secondary">
								Esc
							</kbd>{" "}
							limpar
						</p>
					</div>
				</>
			) : (
				<HistoryList />
			)}
		</div>
	);
}
