import { useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { cmd } from "../lib/tauri";
import type { AppSettings, Project } from "../types";
import { useAppState } from "../state/AppState";
import { ProjectDialog } from "./components/ProjectDialog";

function SideLink({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  return (
    <NavLink
      to={to}
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
  } = useAppState();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<
    { dir: string; name: string | null }[]
  >([]);

  useEffect(() => {
    setSettingsErr(null);
  }, [settings]);

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

  return (
    <div className="min-h-full flex">
      <aside className="w-72 shrink-0 border-r border-border bg-surface">
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
            <SideLink to="/project" label="Project" />
            <SideLink to="/prompts" label="Prompts" />
            <SideLink to="/workflows" label="Workflows" />
            <SideLink to="/settings" label="Settings" />
          </nav>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>

      <ProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
