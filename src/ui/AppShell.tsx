import { useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { cmd } from "../lib/tauri";
import type { AppSettings, Project, Scene, Shot } from "../types";
import { useAppState } from "../state/AppState";
import { ProjectDialog } from "./components/ProjectDialog";
import { Button } from "./components/Button";
import { Input } from "./components/Input";

function SideLink({
  to,
  label,
  onNavigate,
}: {
  to: string;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          "px-3 py-2 rounded-md text-sm font-medium",
          isActive
            ? "bg-surface-2 text-fg"
            : "text-muted hover:bg-surface-hover",
        )
      }
    >
      {label}
    </NavLink>
  );
}

export function AppShell() {
  const nav = useNavigate();
  const {
    settings,
    setSettings,
    workspaceScope,
    setWorkspaceScope,
    currentProjectDir,
    setCurrentProjectDir,
    scenes,
    setScenes,
    selectedSceneId,
    setSelectedSceneId,
    shotsBySceneId,
    setShotsBySceneId,
  } = useAppState();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<
    { dir: string; name: string | null }[]
  >([]);
  const [sceneBusy, setSceneBusy] = useState(false);
  const [sceneErr, setSceneErr] = useState<string | null>(null);
  const [newSceneTitle, setNewSceneTitle] = useState("");

  useEffect(() => {
    setSettingsErr(null);
  }, [settings]);

  useEffect(() => {
    if (workspaceScope !== "project" || !currentProjectDir) return;
    setSceneErr(null);
    setSceneBusy(true);
    cmd<Scene[]>("list_scenes", { project_dir: currentProjectDir })
      .then((sc) => {
        setScenes(sc);
        setSelectedSceneId((prev) => {
          if (prev && sc.some((s) => s.id === prev)) return prev;
          return sc[0]?.id ?? null;
        });
      })
      .catch((e) => setSceneErr(String(e)))
      .finally(() => setSceneBusy(false));
  }, [
    currentProjectDir,
    setScenes,
    setSelectedSceneId,
    workspaceScope,
  ]);

  useEffect(() => {
    const dirs = settings?.recentProjects ?? [];
    if (dirs.length === 0) {
      setRecentProjects([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      dirs.map(async (dir) => {
        try {
          const p = await cmd<Project>("read_project", { project_dir: dir });
          return { dir, name: p.name };
        } catch {
          return { dir, name: null };
        }
      }),
    ).then((list) => {
      if (cancelled) return;
      setRecentProjects(list);
    });
    return () => {
      cancelled = true;
    };
  }, [settings?.recentProjects]);

  const selectorValue = useMemo(() => {
    if (workspaceScope === "global") return "__global__";
    return currentProjectDir ?? "";
  }, [workspaceScope, currentProjectDir]);

  async function onSelectWorkspace(value: string) {
    if (value === "__global__") {
      setWorkspaceScope("global");
      setCurrentProjectDir(null);
      setSelectedSceneId(null);
      setScenes([]);
      setShotsBySceneId({});
      return;
    }
    if (!value.trim()) return;
    try {
      const opened = await cmd<string>("open_project", { dir: value });
      setCurrentProjectDir(opened);
      setWorkspaceScope("project");
      const s = await cmd<AppSettings>("get_settings");
      setSettings(s);
      nav("/project");
    } catch (e) {
      setDialogOpen(true);
      setSettingsErr(String(e));
    }
  }

  async function createSceneFromSidebar() {
    if (!currentProjectDir) return;
    setSceneErr(null);
    setSceneBusy(true);
    try {
      const created = await cmd<Scene>("create_scene", {
        project_dir: currentProjectDir,
        title: newSceneTitle.trim() || null,
      });
      await cmd<void>("create_shot", {
        project_dir: currentProjectDir,
        scene_id: created.id,
      });
      const sc = await cmd<Scene[]>("list_scenes", { project_dir: currentProjectDir });
      setScenes(sc);
      setSelectedSceneId(created.id);
      setNewSceneTitle("");
      const list = await cmd<Shot[]>("list_shots", {
        project_dir: currentProjectDir,
        scene_id: created.id,
        scene_dir: created.dirName,
      });
      setShotsBySceneId({
        ...shotsBySceneId,
        [created.id]: list,
      });
      nav("/project");
    } catch (e) {
      setSceneErr(String(e));
    } finally {
      setSceneBusy(false);
    }
  }

  return (
    <div className="min-h-full flex relative">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={clsx(
          "w-72 shrink-0 border-r border-border bg-surface",
          "fixed inset-y-0 left-0 z-40 md:static md:z-auto",
          "transition-transform md:transition-none",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="px-4 py-4">
          <div className="text-sm font-semibold text-fg">
            Filmclusive Library
          </div>
          <div className="mt-4">
            <div className="text-xs font-medium text-muted-2">Workspace</div>
            <select
              value={selectorValue}
              onChange={(e) => onSelectWorkspace(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
            >
              <option value="__global__">Global</option>
              {workspaceScope === "project" && !currentProjectDir && (
                <option value="" disabled>
                  Select a project…
                </option>
              )}
              {recentProjects.map((p) => (
                <option key={p.dir} value={p.dir}>
                  {p.name ? `${p.name} — ${p.dir}` : p.dir}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-accent-ring"
              onClick={() => setDialogOpen(true)}
            >
              Open / create project…
            </button>
            {settingsErr && (
              <div className="mt-2 text-xs text-danger-fg">{settingsErr}</div>
            )}
          </div>

          <nav className="mt-6 flex flex-col gap-1">
            {workspaceScope === "project" ? (
              <>
                <SideLink to="/project" label="Shots" onNavigate={() => setMobileNavOpen(false)} />
                <SideLink to="/prompts" label="Prompts" onNavigate={() => setMobileNavOpen(false)} />
                <SideLink to="/workflows" label="Workflows" onNavigate={() => setMobileNavOpen(false)} />
              </>
            ) : (
              <>
                <SideLink to="/prompts" label="Prompts" onNavigate={() => setMobileNavOpen(false)} />
                <SideLink to="/workflows" label="Workflows" onNavigate={() => setMobileNavOpen(false)} />
              </>
            )}
            <SideLink to="/dictionary" label="Dictionary" onNavigate={() => setMobileNavOpen(false)} />
            <SideLink to="/settings" label="Settings" onNavigate={() => setMobileNavOpen(false)} />
          </nav>

          {workspaceScope === "project" && currentProjectDir && (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-muted-2">Scenes</div>
                <div className="text-[11px] text-muted-2">
                  {sceneBusy ? "Loading…" : ""}
                </div>
              </div>

              <div className="mt-2 space-y-1">
                {scenes.map((s) => {
                  const count = shotsBySceneId[s.id]?.length;
                  const isActive = s.id === selectedSceneId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedSceneId(s.id);
                        nav("/project");
                      }}
                      className={clsx(
                        "w-full text-left rounded-md border px-3 py-2",
                        isActive
                          ? "border-accent bg-surface-hover"
                          : "border-border bg-surface hover:bg-surface-hover",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-fg">
                          Scene {String(s.number).padStart(2, "0")}
                        </div>
                        {typeof count === "number" && (
                          <div className="text-xs text-muted-2">
                            {count}
                          </div>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        {s.title || "Untitled"}
                      </div>
                    </button>
                  );
                })}
                {scenes.length === 0 && (
                  <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted">
                    No scenes yet.
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-2">
                <Input
                  value={newSceneTitle}
                  onChange={setNewSceneTitle}
                  placeholder="New scene title"
                />
                <Button
                  onClick={createSceneFromSidebar}
                  disabled={sceneBusy}
                  variant="secondary"
                >
                  Add scene
                </Button>
                {sceneErr && (
                  <div className="text-xs text-danger-fg">{sceneErr}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 pt-10 md:pt-0">
        {!mobileNavOpen && (
          <button
            type="button"
            aria-label="Open navigation"
            className="fixed left-3 top-3 z-20 rounded-md border border-border bg-surface p-2 text-fg shadow-sm hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-accent-ring md:hidden"
            onClick={() => setMobileNavOpen(true)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          </button>
        )}
        <Outlet />
      </main>

      <ProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
