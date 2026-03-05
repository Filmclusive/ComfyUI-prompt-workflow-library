import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { open as openDialog, save as saveDialog } from "@tauri-apps/api/dialog";
import { cmd } from "../../lib/tauri";
import type { AppSettings } from "../../types";
import { useAppState } from "../../state/AppState";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";

export function ProjectDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const nav = useNavigate();
  const { setCurrentProjectDir, setWorkspaceScope, setSettings } = useAppState();

  const [mode, setMode] = useState<"open" | "create">("create");
  const [projectName, setProjectName] = useState("My Project");
  const [createProjectDir, setCreateProjectDir] = useState("");
  const [openProjectDir, setOpenProjectDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("create");
    setErr(null);
    setBusy(false);
  }, [open]);

  async function refreshSettings() {
    try {
      const s = await cmd<AppSettings>("get_settings");
      setSettings(s);
    } catch {
      // ignore; settings are non-blocking for project open/create
    }
  }

  async function openProject() {
    setErr(null);
    setBusy(true);
    try {
      const opened = await cmd<string>("open_project", {
        dir: openProjectDir.trim(),
      });
      setCurrentProjectDir(opened);
      setWorkspaceScope("project");
      await refreshSettings();
      nav("/project");
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    setErr(null);
    setBusy(true);
    try {
      const name = projectName.trim();
      const dir = createProjectDir.trim();
      const created = await cmd<string>("create_project", {
        name,
        dir,
      });
      setCurrentProjectDir(created);
      setWorkspaceScope("project");
      await refreshSettings();
      nav("/project");
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

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

  async function browseForOpenProjectDir() {
    setErr(null);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select an existing project folder",
      });
      const dir = Array.isArray(selected) ? selected[0] : selected;
      if (!dir) return;
      setOpenProjectDir(dir);
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <Modal open={open} title="Open / Create project" onClose={onClose}>
      {err && (
        <div className="mb-3 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-fg">
          {err}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-fg">
          {mode === "create" ? "Create new project" : "Open existing project"}
        </div>
        <Button
          variant="secondary"
          onClick={() => setMode((m) => (m === "create" ? "open" : "create"))}
          disabled={busy}
        >
          {mode === "create" ? "Open existing…" : "Create new"}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {mode === "create" ? (
          <>
            <div>
              <div className="text-xs font-medium text-muted-2">Name</div>
              <div className="mt-1">
                <Input value={projectName} onChange={setProjectName} />
              </div>
            </div>

	            <div>
	              <div className="text-xs font-medium text-muted-2">
	                Project folder
	              </div>
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
          </>
        ) : (
          <div>
            <div className="text-xs font-medium text-muted-2">Project folder</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  value={openProjectDir}
                  onChange={setOpenProjectDir}
                  placeholder="/path/to/MyProject"
                />
              </div>
              <Button
                variant="secondary"
                onClick={browseForOpenProjectDir}
                disabled={busy}
              >
                Browse…
              </Button>
            </div>
            <div className="mt-1 text-xs text-muted-2">
              Select an existing project folder (must contain project.json).
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {mode === "open" ? (
            <Button
              onClick={openProject}
              disabled={busy || !openProjectDir.trim()}
            >
              Open
            </Button>
          ) : (
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
          )}
        </div>
      </div>
    </Modal>
  );
}
