import { useEffect, useMemo, useState } from "react";
import { cmd } from "../../lib/tauri";
import type { WorkflowSummary } from "../../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useAppState } from "../../state/AppState";
import { open } from "@tauri-apps/api/dialog";
import { appWindow } from "@tauri-apps/api/window";

export function WorkflowManagerPage() {
  const { currentProjectDir, workspaceScope } = useAppState();
  const [items, setItems] = useState<WorkflowSummary[]>([]);
  const [title, setTitle] = useState("New workflow");
  const [jsonPath, setJsonPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);

  const resolvedProjectDir = useMemo(() => {
    if (workspaceScope !== "project") return null;
    return currentProjectDir;
  }, [workspaceScope, currentProjectDir]);

  const scope: "global" | "project" =
    workspaceScope === "global" ? "global" : "project";

  async function refresh() {
    setBusy(true);
    setErr(null);
    try {
      const list = await cmd<WorkflowSummary[]>("list_workflows", {
        scope,
        project_dir: resolvedProjectDir,
      });
      setItems(list);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, resolvedProjectDir]);

  async function importWorkflow() {
    setBusy(true);
    setErr(null);
    try {
      const p = jsonPath.trim();
      if (!p) {
        setErr("Choose a workflow JSON file first.");
        return;
      }
      if (!p.toLowerCase().endsWith(".json")) {
        setErr("Workflow file must be a .json file.");
        return;
      }
      await cmd<void>("import_workflow", {
        scope,
        project_dir: resolvedProjectDir,
        title,
        workflow_json_path: p,
      });
      setJsonPath("");
      await refresh();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function chooseWorkflowFile() {
    setErr(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Workflow JSON", extensions: ["json"] }],
      });
      if (typeof selected === "string") {
        setJsonPath(selected);
        const name = selected.split(/[/\\]/).pop() ?? "";
        const base = name.replace(/\.json$/i, "");
        if (base && (title.trim() === "" || title === "New workflow")) {
          setTitle(base);
        }
      }
    } catch (e) {
      setErr(String(e));
    }
  }

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    appWindow
      .onFileDropEvent((event) => {
        if (event.payload.type === "hover") {
          setDropActive(true);
          return;
        }
        if (event.payload.type === "cancel") {
          setDropActive(false);
          return;
        }
        if (event.payload.type === "drop") {
          setDropActive(false);
          const p = event.payload.paths?.[0];
          if (!p) return;
          if (!p.toLowerCase().endsWith(".json")) {
            setErr("Dropped file must be a .json workflow.");
            return;
          }
          setJsonPath(p);
          const name = p.split(/[/\\]/).pop() ?? "";
          const base = name.replace(/\.json$/i, "");
          if (base && (title.trim() === "" || title === "New workflow")) {
            setTitle(base);
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        unlisten = null;
      });
    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approved = useMemo(
    () => items.filter((w) => w.tags.includes("filmclusive-approved")),
    [items],
  );
  const custom = useMemo(
    () => items.filter((w) => !w.tags.includes("filmclusive-approved")),
    [items],
  );

  function modelsFromTags(tags: string[]) {
    const models = tags
      .filter((t) => t.startsWith("model:"))
      .map((t) => t.slice("model:".length))
      .filter(Boolean);
    return models.length ? models.join(", ") : null;
  }

  return (
    <div className="p-4 max-w-5xl">
      <div className="text-lg font-semibold text-fg">Workflows</div>
      <div className="mt-2 text-sm text-muted">
        Import ComfyUI workflow JSON files and add metadata for variable injection.
      </div>

      {err && (
        <div className="mt-3 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-fg">
          {err}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <div className="text-xs font-medium text-muted-2">
          Scope: {scope === "global" ? "Global" : "Project"}
        </div>
        <Button variant="secondary" onClick={refresh} disabled={busy}>
          Refresh
        </Button>
      </div>

      {workspaceScope === "project" && !currentProjectDir && (
        <div className="mt-3 rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning-fg">
          Select or create a project from the sidebar to manage project workflows.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-sm font-semibold text-fg">
            Import and save
          </div>
          <div className="mt-3 space-y-3">
            <div
              className={[
                "rounded-md border border-dashed px-3 py-3 text-sm text-muted",
                dropActive
                  ? "border-accent bg-accent/10 text-fg"
                  : "border-border bg-surface",
              ].join(" ")}
            >
              Drag a workflow JSON into this window to select it, or choose a file.
            </div>
            <div>
              <div className="text-xs font-medium text-muted-2">Title</div>
              <div className="mt-1">
                <Input value={title} onChange={setTitle} />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-2">
                Workflow JSON file
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  value={jsonPath}
                  onChange={setJsonPath}
                  placeholder="/path/to/workflow.json"
                />
                <Button
                  variant="secondary"
                  onClick={chooseWorkflowFile}
                  disabled={busy || (workspaceScope === "project" && !currentProjectDir)}
                >
                  Choose
                </Button>
              </div>
            </div>
            <Button
              onClick={importWorkflow}
              disabled={
                busy ||
                !jsonPath.trim() ||
                (workspaceScope === "project" && !currentProjectDir)
              }
            >
              Import and save
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-sm font-semibold text-fg">Saved</div>
          <div className="mt-3 space-y-2">
            {approved.length > 0 && (
              <div className="pt-1">
                <div className="text-xs font-semibold text-fg">
                  Filmclusive approved
                </div>
                <div className="mt-2 space-y-2">
                  {approved.map((w) => (
                    <div
                      key={w.id}
                      className="rounded-md border border-border bg-surface px-3 py-2"
                    >
                      <div className="text-sm font-medium text-fg">
                        {w.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-2">
                        Updated {new Date(w.updatedAt).toLocaleString()}
                      </div>
                      {modelsFromTags(w.tags) && (
                        <div className="mt-1 text-xs text-muted-2">
                          Models {modelsFromTags(w.tags)}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-muted-2">
                        {w.tags.length ? w.tags.join(", ") : "No tags"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {custom.length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-semibold text-fg">
                  Custom
                </div>
                <div className="mt-2 space-y-2">
                  {custom.map((w) => (
                    <div
                      key={w.id}
                      className="rounded-md border border-border bg-surface px-3 py-2"
                    >
                      <div className="text-sm font-medium text-fg">
                        {w.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-2">
                        Updated {new Date(w.updatedAt).toLocaleString()}
                      </div>
                      {modelsFromTags(w.tags) && (
                        <div className="mt-1 text-xs text-muted-2">
                          Models {modelsFromTags(w.tags)}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-muted-2">
                        {w.tags.length ? w.tags.join(", ") : "No tags"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {items.length === 0 && (
              <div className="text-sm text-muted">No workflows yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
