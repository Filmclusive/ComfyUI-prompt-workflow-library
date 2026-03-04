import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  AppSettings,
  Project,
  Scene,
  Shot,
  WorkflowSummary,
  PromptEntry,
} from "../types";
import { cmd } from "../lib/tauri";
import { applyThemeSetting } from "../lib/theme";

type AppState = {
  settings: AppSettings | null;
  setSettings: (s: AppSettings | null) => void;
  workspaceScope: "global" | "project";
  setWorkspaceScope: (s: "global" | "project") => void;
  currentProjectDir: string | null;
  setCurrentProjectDir: (d: string | null) => void;
  project: Project | null;
  setProject: (p: Project | null) => void;
  scenes: Scene[];
  setScenes: (s: Scene[]) => void;
  shotsBySceneId: Record<string, Shot[]>;
  setShotsBySceneId: (s: Record<string, Shot[]>) => void;
  workflows: WorkflowSummary[];
  setWorkflows: (w: WorkflowSummary[]) => void;
  prompts: PromptEntry[];
  setPrompts: (p: PromptEntry[]) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [workspaceScope, setWorkspaceScope] = useState<"global" | "project">(
    "global",
  );
  const [currentProjectDir, setCurrentProjectDir] = useState<string | null>(
    null,
  );
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [shotsBySceneId, setShotsBySceneId] = useState<
    Record<string, Shot[]>
  >({});
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);

  useEffect(() => {
    cmd<AppSettings>("get_settings").then(setSettings).catch(() => {
      // non-blocking
    });
  }, []);

  useEffect(() => {
    applyThemeSetting(settings?.theme);
  }, [settings?.theme]);

  const value = useMemo<AppState>(
    () => ({
      settings,
      setSettings,
      workspaceScope,
      setWorkspaceScope,
      currentProjectDir,
      setCurrentProjectDir,
      project,
      setProject,
      scenes,
      setScenes,
      shotsBySceneId,
      setShotsBySceneId,
      workflows,
      setWorkflows,
      prompts,
      setPrompts,
    }),
    [
      settings,
      workspaceScope,
      currentProjectDir,
      project,
      scenes,
      shotsBySceneId,
      workflows,
      prompts,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppStateProvider missing");
  return v;
}
