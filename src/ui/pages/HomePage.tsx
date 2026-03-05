import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { save as saveDialog } from "@tauri-apps/api/dialog";
import { cmd } from "../../lib/tauri";
import { useAppState } from "../../state/AppState";
import type { AppSettings } from "../../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";

export function HomePage() {
  const nav = useNavigate();
  const {
    settings,
    setSettings,
    setCurrentProjectDir,
    setWorkspaceScope,
  } = useAppState();
  const [projectName, setProjectName] = useState("My Project");
  const [createProjectDir, setCreateProjectDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    cmd<AppSettings>("get_settings")
      .then(setSettings)
      .catch((e) => setErr(String(e)));
  }, [setSettings]);

  async function browseForCreateProjectDir() {
    setErr(null);
    try {
      const selected = await saveDialog({
        title: "Choose project folder",
        defaultPath: createProjectDir.trim() || projectName.trim() || undefined,
      });
      if (!selected) return;
      setCreateProjectDir(selected);
    } catch (e) {
      setErr(String(e));
    }
  }

  async function createProject() {
    setErr(null);
    setBusy(true);
    try {
      const name = projectName.trim();
      const createdDir = await cmd<string>("create_project", {
        name,
        dir: createProjectDir.trim(),
      });
      setCurrentProjectDir(createdDir);
      setWorkspaceScope("project");
      const s = await cmd<AppSettings>("get_settings");
      setSettings(s);
      nav("/project");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openRecent(dir: string) {
    setErr(null);
    setBusy(true);
    try {
      const opened = await cmd<string>("open_project", { dir });
      setCurrentProjectDir(opened);
      setWorkspaceScope("project");
      const s = await cmd<AppSettings>("get_settings");
      setSettings(s);
      nav("/project");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 max-w-4xl">
      <div className="text-lg font-semibold text-fg">Home</div>
      <div className="mt-2 text-sm text-muted">
        Create a project folder or open a recent one.
      </div>

      {err && (
        <div className="mt-3 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-fg">
          {err}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-sm font-semibold text-fg">
            Create project
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <div className="text-xs font-medium text-muted-2">Name</div>
              <div className="mt-1">
                <Input value={projectName} onChange={setProjectName} />
              </div>
            </div>
	            <div>
	              <div className="text-xs font-medium text-muted-2">Project folder</div>
	              <div className="mt-1 flex items-center gap-2">
	                <div className="flex-1 min-w-0">
	                  <Input
	                    value={createProjectDir}
	                    onChange={setCreateProjectDir}
	                    placeholder="/path/to/MyProject"
	                  />
	                </div>
	                <Button
	                  variant="secondary"
	                  onClick={browseForCreateProjectDir}
	                  disabled={busy}
	                >
	                  Browse…
	                </Button>
	              </div>
	              <div className="mt-1 text-xs text-muted-2">
	                Choose a location and enter a new folder name in the dialog.
	                The app creates the folder and writes files inside it.
	                External drives are supported.
	              </div>
	            </div>
            <Button
              onClick={createProject}
	              disabled={
	                busy ||
	                !projectName.trim() ||
	                !createProjectDir.trim()
	              }
	            >
              Create
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-sm font-semibold text-fg">
            Recent projects
          </div>
          <div className="mt-3 space-y-2">
            {(settings?.recentProjects ?? []).length === 0 && (
              <div className="text-sm text-muted">No recent projects.</div>
            )}
            {(settings?.recentProjects ?? []).map((dir) => (
              <div
                key={dir}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
              >
                <div className="truncate text-sm text-muted">{dir}</div>
                <Button onClick={() => openRecent(dir)} disabled={busy}>
                  Open
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
