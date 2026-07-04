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
	}, []);

	if (loading) {
		return <p className="text-text-muted text-sm">Carregando histórico...</p>;
	}

	if (history.length === 0) {
		return (
			<p className="text-text-muted text-sm">Nenhuma execução registrada.</p>
		);
	}

	return (
		<div className="space-y-2">
			{history.map((entry) => (
				<div
					key={entry.id}
					className="bg-surface border border-border rounded-lg p-3"
				>
					<div className="flex items-center justify-between mb-1">
						<span className="text-xs font-medium text-accent-hover">
							{entry.tool_name}
						</span>
						<span className="text-xs text-text-muted">
							{new Date(entry.timestamp).toLocaleString("pt-BR")}
						</span>
					</div>
					<p className="text-sm text-text-secondary truncate">
						{entry.input_preview}
					</p>
				</div>
			))}
		</div>
	);
}
