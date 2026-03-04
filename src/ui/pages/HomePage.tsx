import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { open as openDialog } from "@tauri-apps/api/dialog";
import { join } from "@tauri-apps/api/path";
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
  const [createParentDir, setCreateParentDir] = useState("");
  const [createDirPreview, setCreateDirPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    cmd<AppSettings>("get_settings")
      .then(setSettings)
      .catch((e) => setErr(String(e)));
  }, [setSettings]);

  useEffect(() => {
    let cancelled = false;
    const parent = createParentDir.trim();
    const name = projectName.trim();
    if (!parent || !name) {
      setCreateDirPreview("");
      return;
    }
    join(parent, name)
      .then((p) => {
        if (cancelled) return;
        setCreateDirPreview(p);
      })
      .catch(() => {
        if (cancelled) return;
        setCreateDirPreview("");
      });
    return () => {
      cancelled = true;
    };
  }, [createParentDir, projectName]);

  async function browseForCreateParentDir() {
    setErr(null);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Choose project location",
      });
      if (!selected || Array.isArray(selected)) return;
      setCreateParentDir(selected);
    } catch (e) {
      setErr(String(e));
    }
  }

  async function createProject() {
    setErr(null);
    setBusy(true);
    try {
      const parent = createParentDir.trim();
      const name = projectName.trim();
      const targetDir = await join(parent, name);
      const createdDir = await cmd<string>("create_project", {
        name,
        dir: targetDir,
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
              <div className="text-xs font-medium text-muted-2">
                Location
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    value={createParentDir}
                    onChange={setCreateParentDir}
                    placeholder="/path/to/folder"
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={browseForCreateParentDir}
                  disabled={busy}
                >
                  Browse…
                </Button>
              </div>
              <div className="mt-1 text-xs text-muted-2">
                Choose where the project folder should be created (external drives are supported).
              </div>
              <div className="mt-2 text-xs text-muted-2">
                Will create:{" "}
                <span className="text-muted">
                  {createDirPreview ? createDirPreview : "—"}
                </span>
              </div>
            </div>
            <Button
              onClick={createProject}
              disabled={
                busy ||
                !projectName.trim() ||
                !createParentDir.trim() ||
                !createDirPreview
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
