import type { WorkflowTemplate } from "@desktop-agent/shared";
import { Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Label } from "../../../components/ui/primitives/label";
import { SELECT_CLASS } from "../constants";

type Props = {
  templates: WorkflowTemplate[];
  selectedWorkflowId: string | null;
  onSelect: (id: string | null) => void;
  selectId?: string;
};

export function WorkflowSelector(p: Props) {
  const { t } = useTranslation("helix");
  const selectId = p.selectId ?? "workflow-select";
  const selected = p.templates.find((t) => t.id === p.selectedWorkflowId);
  const enabledTemplates = p.templates.filter((t) => t.enabled);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={selectId} className="flex items-center gap-1.5">
        <Workflow className="w-3 h-3 text-signal" />
        {t("helix:workflowSelector.label")}
      </Label>
      <select
        id={selectId}
        className={SELECT_CLASS}
        value={p.selectedWorkflowId ?? ""}
        onChange={(e) => p.onSelect(e.target.value || null)}
      >
        <option value="">{t("helix:workflowSelector.defaultOption")}</option>
        {enabledTemplates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} · {template.mode} · {template.steps.length} {t("helix:workflowSelector.steps")}
          </option>
        ))}
      </select>
      {selected ? (
        <div className="rounded-md bg-signal/5 border border-signal/20 px-2.5 py-1.5">
          <p className="text-[10px] text-signal/80 leading-relaxed">
            {selected.description || t("helix:workflowSelector.useTemplate")}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[9px] text-faint">
            <span>
              {selected.maxSteps} {t("helix:workflowSelector.maxSteps")}
            </span>
            <span className="w-0.5 h-0.5 rounded-full bg-faint" />
            <span>
              {selected.steps.length} {t("helix:workflowSelector.steps")}
            </span>
            <span className="w-0.5 h-0.5 rounded-full bg-faint" />
            <span>{selected.settings?.approvalThreshold ?? "all"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
