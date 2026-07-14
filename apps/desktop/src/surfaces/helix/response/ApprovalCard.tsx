import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/primitives/button";

export type ApprovalViewModel = {
  toolName: string;
  reason: string;
  permissionLevel: string;
  inputPreview: string;
};

export function ApprovalCard({
  approval,
  onDecision,
  compact = false,
  busy = false,
}: {
  approval: ApprovalViewModel;
  onDecision: (approved: boolean) => void;
  compact?: boolean;
  busy?: boolean;
}) {
  const { t } = useTranslation("helix");
  if (compact) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/[0.07] px-2.5 py-2"
        role="alert"
      >
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warn/10 text-warn">
          <span className="absolute inset-0 rounded-full border border-warn/50 motion-safe:animate-ping" />
          <ShieldAlert className="relative h-3 w-3" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-medium text-fg">
            {t("helix:approval.pendingTool", {
              tool: approval.toolName,
              defaultValue: `${approval.toolName} aguarda aprovação`,
            })}
          </p>
          <p className="truncate text-[9px] text-faint">{approval.permissionLevel}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => onDecision(true)} disabled={busy}>
          {t("helix:normalCommandView.approve")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDecision(false)} disabled={busy}>
          {t("helix:normalCommandView.deny")}
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-warn/30 bg-warn/[0.055] p-3.5" role="alert">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-warn/25 bg-warn/10 text-warn">
          <ShieldAlert className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-xs font-semibold text-fg">{t("helix:normalCommandView.approvalRequired")}</h3>
            <span className="rounded-full border border-warn/25 px-1.5 py-0.5 text-[9px] text-warn">
              {approval.permissionLevel}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-mute">{approval.reason}</p>
          <div className="mt-2 rounded-md border border-line/70 bg-ink/25 px-2.5 py-2">
            <p className="font-mono text-[10px] text-fg/85">{approval.toolName}</p>
            {approval.inputPreview && (
              <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all text-[9px] text-faint">
                {approval.inputPreview}
              </pre>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => onDecision(false)} disabled={busy}>
          {t("helix:normalCommandView.deny")}
        </Button>
        <Button variant="primary" size="sm" onClick={() => onDecision(true)} disabled={busy}>
          {t("helix:normalCommandView.approve")}
        </Button>
      </div>
    </section>
  );
}
