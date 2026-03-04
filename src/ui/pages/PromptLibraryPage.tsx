import { useEffect, useMemo, useState } from "react";
import { cmd } from "../../lib/tauri";
import type { PromptEntry, PromptScope } from "../../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { useAppState } from "../../state/AppState";

export function PromptLibraryPage() {
  const { currentProjectDir, workspaceScope } = useAppState();
  const [items, setItems] = useState<PromptEntry[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const resolvedParentDir = useMemo(() => {
    if (workspaceScope === "global") return null;
    if (currentProjectDir) return currentProjectDir;
    return null;
  }, [workspaceScope, currentProjectDir]);

  const scope: PromptScope = workspaceScope === "global" ? "global" : "project";

  async function refresh() {
    setBusy(true);
    setErr(null);
    try {
      const list = await cmd<PromptEntry[]>("list_prompt_entries", {
        scope,
        parent_dir: resolvedParentDir,
        parent_id: null,
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
  }, [scope, resolvedParentDir]);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      await cmd<PromptEntry>("create_prompt_entry", {
        scope,
        parent_dir: resolvedParentDir,
        parent_id: null,
        title,
        body,
        tags: [],
        kind: "both",
      });
      setTitle("");
      setBody("");
      await refresh();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await cmd<void>("delete_prompt_entry", {
        scope,
        parent_dir: resolvedParentDir,
        id,
      });
      await refresh();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 max-w-5xl">
      <div className="text-lg font-semibold text-fg">Prompt library</div>
      <div className="mt-2 text-sm text-muted">
        {workspaceScope === "global"
          ? "Global prompts are available across all projects."
          : "Project prompts apply to the selected project."}
      </div>

      {err && (
        <div className="mt-3 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-fg">
          {err}
        </div>
      )}

      {workspaceScope === "project" && !currentProjectDir && (
        <div className="mt-4 rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning-fg">
          Select or create a project from the sidebar to view project prompts.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-sm font-semibold text-fg">
            Create prompt
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <div className="text-xs font-medium text-muted-2">Title</div>
              <div className="mt-1">
                <Input value={title} onChange={setTitle} />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-2">Body</div>
              <div className="mt-1">
                <Textarea value={body} onChange={setBody} rows={10} />
              </div>
            </div>
            <Button
              onClick={create}
              disabled={
                busy ||
                !title.trim() ||
                (workspaceScope === "project" && !currentProjectDir)
              }
            >
              Create
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-fg">Saved</div>
            <Button variant="secondary" onClick={refresh} disabled={busy}>
              Refresh
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {items.map((p) => (
              <div
                key={p.id}
                className="rounded-md border border-border bg-surface px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-fg">
                    {p.title}
                  </div>
                  <Button variant="danger" onClick={() => remove(p.id)} disabled={busy}>
                    Delete
                  </Button>
                </div>
                <div className="mt-2 text-sm text-muted whitespace-pre-wrap">
                  {p.body}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-muted">No prompts yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
