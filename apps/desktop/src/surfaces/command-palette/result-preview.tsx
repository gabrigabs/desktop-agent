type ResultPreviewProps = {
	content: string;
	onCopy: () => void;
};

export function ResultPreview({ content, onCopy }: ResultPreviewProps) {
	return (
		<div className="mt-6">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-medium text-text-secondary">Resultado</h3>
				<button
					onClick={onCopy}
					className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent-hover transition-colors"
				>
					Copiar para clipboard
				</button>
			</div>
			<div className="bg-surface border border-border rounded-lg p-4 text-sm text-text-primary leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
				{content}
			</div>
		</div>
	);
}
