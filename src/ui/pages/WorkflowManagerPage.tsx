import { useEffect, useMemo, useState } from "react";
import { cmd } from "../../lib/tauri";
import type { WorkflowSummary } from "../../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useAppState } from "../../state/AppState";

export function WorkflowManagerPage() {
  const { currentProjectDir, workspaceScope } = useAppState();
  const [items, setItems] = useState<WorkflowSummary[]>([]);
  const [title, setTitle] = useState("New workflow");
  const [jsonPath, setJsonPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      await cmd<void>("import_workflow", {
        scope,
        project_dir: resolvedProjectDir,
        title,
        workflow_json_path: jsonPath,
      });
      setJsonPath("");
      await refresh();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
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
            Import workflow
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <div className="text-xs font-medium text-muted-2">Title</div>
              <div className="mt-1">
                <Input value={title} onChange={setTitle} />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-2">
                Path to workflow JSON
              </div>
              <div className="mt-1">
                <Input
                  value={jsonPath}
                  onChange={setJsonPath}
                  placeholder="/path/to/workflow.json"
                />
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
              Import
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-sm font-semibold text-fg">Saved</div>
          <div className="mt-3 space-y-2">
            {items.map((w) => (
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
                <div className="mt-1 text-xs text-muted-2">
                  {w.tags.length ? w.tags.join(", ") : "No tags"}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-muted">No workflows yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
