import { useAgentStore } from "./stores/agent";
import { CommandPalette } from "./surfaces/command-palette";

export function App() {
	const connected = useAgentStore((s) => s.connected);

	return (
		<div className="h-screen flex flex-col bg-zinc-950">
			{!connected && (
				<div className="flex items-center justify-center h-10 bg-amber-900/30 text-amber-200 text-sm px-4">
					Conectando ao agent runtime...
				</div>
			)}
			<CommandPalette />
		</div>
	);
}
