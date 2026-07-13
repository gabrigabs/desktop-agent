import type { AgentProfile } from "@desktop-agent/shared";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Brain, ChevronRight, FileText, FolderOpen, Image as ImageIcon, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import type { useWorkspaces } from "./hooks/useWorkspaces";
import { WorkspaceIcon } from "./workspace-visuals";

type Props = {
  ws: ReturnType<typeof useWorkspaces>;
  profiles: AgentProfile[];
  onManage: () => void;
};

export function WorkspaceInspector({ ws, profiles, onManage }: Props) {
  const { t } = useTranslation("helix");
  const workspace = ws.activeWorkspace;
  if (!workspace) return null;
  const facts = ws.memoryFacts.filter((fact) => fact.status === "active");
  const profile = profiles.find((item) => item.id === workspace.profileId);

  return (
    <section
      className="overflow-hidden rounded-lg border bg-white/[0.012]"
      style={{ borderColor: `${workspace.color}42` }}
    >
      <div className="relative p-3.5">
        <span className="absolute inset-y-0 left-0 w-0.5" style={{ backgroundColor: workspace.color }} />
        <div className="flex items-start gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line"
            style={{ color: workspace.color }}
          >
            <WorkspaceIcon icon={workspace.icon} className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span
              className="text-[8px] font-medium uppercase tracking-[0.14em]"
              style={{ color: workspace.color }}
            >
              {t("helix:workspace.activeSpace")}
            </span>
            <h3 className="mt-0.5 truncate text-sm font-semibold text-fg">{workspace.name}</h3>
            <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-mute">
              {workspace.purpose || t("helix:workspace.noPurpose")}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 truncate text-[9px] text-faint">
          <FolderOpen className="h-3 w-3 shrink-0" />
          {workspace.folderPath || t("helix:workspace.noFolder")}
        </div>
      </div>

      <div className="grid grid-cols-2 border-y border-line">
        <InspectorMetric icon={Brain} value={facts.length} label={t("helix:workspace.memory")} />
        <InspectorMetric
          icon={FileText}
          value={ws.documents.length}
          label={t("helix:workspace.sources")}
          border
        />
      </div>

      <div className="grid gap-3 p-3.5">
        <div>
          <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-faint">
            {t("helix:workspace.instructionsLabel")}
          </span>
          <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[10px] leading-relaxed text-mute">
            {workspace.instructions || t("helix:workspace.noInstructions")}
          </p>
        </div>

        {facts.length > 0 && (
          <div className="border-t border-line pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-faint">
                {t("helix:workspace.recentMemory")}
              </span>
              <span className="text-[9px] text-faint">{facts.length}</span>
            </div>
            <div className="grid gap-1.5">
              {facts.slice(0, 3).map((fact) => (
                <div
                  key={fact.id}
                  className="border-l border-line py-1 pl-2.5 text-[10px] leading-relaxed text-mute"
                >
                  <span className="mr-1.5" style={{ color: workspace.color }}>
                    •
                  </span>
                  {fact.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {ws.documents.length > 0 && (
          <div className="border-t border-line pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-faint">
                {t("helix:workspace.pinnedSources")}
              </span>
              <span className="text-[9px] text-faint">{ws.documents.length}</span>
            </div>
            <div className="grid gap-1.5">
              {ws.documents.slice(0, 4).map((document) => (
                <div
                  key={document.id}
                  className="flex min-w-0 items-center gap-2 border-b border-line p-1.5 last:border-b-0"
                >
                  {document.parsedFormat === "image" ? (
                    <img
                      src={convertFileSrc(document.path)}
                      alt=""
                      className="h-7 w-7 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-faint">
                      {document.mimeType.startsWith("image/") ? (
                        <ImageIcon className="h-3 w-3" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[10px] text-mute">
                    {document.displayName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <div className="min-w-0">
            <span className="block text-[8px] uppercase tracking-[0.12em] text-faint">
              {t("helix:workspace.profileLabel")}
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-mute">
              {profile?.name ?? t("helix:workspace.defaultProfile")}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onManage} className="shrink-0 gap-1 px-2 text-[10px]">
            <Settings2 className="h-3 w-3" />
            {t("helix:workspace.manage")}
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function InspectorMetric({
  icon: Icon,
  value,
  label,
  border = false,
}: {
  icon: typeof Brain;
  value: number;
  label: string;
  border?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 ${border ? "border-l border-line" : ""}`}>
      <Icon className="h-3.5 w-3.5 text-faint" />
      <div>
        <strong className="block text-sm font-semibold text-fg">{value}</strong>
        <span className="block text-[8px] uppercase tracking-wider text-faint">{label}</span>
      </div>
    </div>
  );
}
