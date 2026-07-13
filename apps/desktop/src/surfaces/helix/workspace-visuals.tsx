import {
  BookOpen,
  BriefcaseBusiness,
  Camera,
  Code2,
  FolderOpen,
  GraduationCap,
  HeartPulse,
  Home,
  Music2,
  Palette,
  Rocket,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import type { ComponentType } from "react";

export const WORKSPACE_COLORS = [
  "#8b7cf6",
  "#c499f4",
  "#ec6f9e",
  "#f0a35b",
  "#55b99d",
  "#50a9bd",
  "#5d8ee8",
  "#dd6b74",
  "#a8b85b",
  "#b27cdb",
  "#da8d68",
  "#6aa7e8",
] as const;

export const WORKSPACE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  folder: FolderOpen,
  briefcase: BriefcaseBusiness,
  code: Code2,
  study: GraduationCap,
  book: BookOpen,
  rocket: Rocket,
  palette: Palette,
  wallet: WalletCards,
  health: HeartPulse,
  camera: Camera,
  music: Music2,
  home: Home,
  target: Target,
  sparkles: Sparkles,
};

export function WorkspaceIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = WORKSPACE_ICONS[icon] ?? FolderOpen;
  return <Icon className={className} />;
}
