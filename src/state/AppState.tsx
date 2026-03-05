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
  setSettings: React.Dispatch<React.SetStateAction<AppSettings | null>>;
  workspaceScope: "global" | "project";
  setWorkspaceScope: React.Dispatch<React.SetStateAction<"global" | "project">>;
  currentProjectDir: string | null;
  setCurrentProjectDir: React.Dispatch<React.SetStateAction<string | null>>;
  project: Project | null;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  scenes: Scene[];
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
  selectedSceneId: string | null;
  setSelectedSceneId: React.Dispatch<React.SetStateAction<string | null>>;
  shotsBySceneId: Record<string, Shot[]>;
  setShotsBySceneId: React.Dispatch<
    React.SetStateAction<Record<string, Shot[]>>
  >;
  workflows: WorkflowSummary[];
  setWorkflows: React.Dispatch<React.SetStateAction<WorkflowSummary[]>>;
  prompts: PromptEntry[];
  setPrompts: React.Dispatch<React.SetStateAction<PromptEntry[]>>;
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
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
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
      selectedSceneId,
      setSelectedSceneId,
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
      selectedSceneId,
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
