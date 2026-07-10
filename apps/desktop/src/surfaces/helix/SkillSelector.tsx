import type { Skill } from "@desktop-agent/shared";
import { Bot } from "lucide-react";
import { Label } from "../../components/ui/label";
import { SELECT_CLASS } from "./constants";

type Props = {
  skills: Skill[];
  selectedSkillId: string | null;
  onSelect: (id: string | null) => void;
  selectId?: string;
};

export function SkillSelector(p: Props) {
  const selectId = p.selectId ?? "skill-select";
  const selected = p.skills.find((s) => s.id === p.selectedSkillId);
  const enabledSkills = p.skills.filter((s) => s.enabled);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={selectId} className="flex items-center gap-1.5">
        <Bot className="w-3 h-3 text-signal" />
        Skill
      </Label>
      <select
        id={selectId}
        className={SELECT_CLASS}
        value={p.selectedSkillId ?? ""}
        onChange={(e) => p.onSelect(e.target.value || null)}
      >
        <option value="">Nenhum (comportamento padrão)</option>
        {enabledSkills.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {selected ? (
        <div className="rounded-md bg-signal/5 border border-signal/20 px-2.5 py-1.5">
          <p className="text-[11px] text-fg leading-relaxed">
            {selected.description || "Usar esta skill ao executar"}
          </p>
          <div className="flex items-center flex-wrap gap-2 mt-1.5 text-[9px] text-faint">
            <span className="rounded bg-white/[0.03] px-1.5 py-0.5 font-mono">
              {selected.provider || "padrão"}:{selected.model || "auto"}
            </span>
            <span>{selected.maxSteps ?? 1} passos</span>
            {selected.compatibility ? (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-faint" />
                <span>{selected.compatibility}</span>
              </>
            ) : null}
            {selected.toolAllowlist && selected.toolAllowlist.length > 0 ? (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-faint" />
                <span>{selected.toolAllowlist.length} ferramentas</span>
              </>
            ) : null}
            {selected.metadata
              ? Object.entries(selected.metadata).map(([key, value]) => (
                  <span key={key} className="rounded bg-white/[0.03] px-1.5 py-0.5 font-mono">
                    {key}: {value}
                  </span>
                ))
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
