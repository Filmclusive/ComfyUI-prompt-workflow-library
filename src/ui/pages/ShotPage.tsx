import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { writeText } from "@tauri-apps/api/clipboard";
import { open } from "@tauri-apps/api/shell";
import { open as openDialog } from "@tauri-apps/api/dialog";
import { join } from "@tauri-apps/api/path";
import { cmd } from "../../lib/tauri";
import type { AttachmentRole, Shot, WorkflowSummary } from "../../types";
import { useAppState } from "../../state/AppState";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";

type Revision = {
  id: string;
  dirName: string;
  createdAt: string;
  message: string | null;
};

type DiffResult = {
  positive: string;
  negative: string;
  shotJson: string;
};

export function ShotPage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const projectDir = sp.get("projectDir");
  const sceneId = sp.get("sceneId");
  const shotId = sp.get("shotId");

  const { setWorkspaceScope, setCurrentProjectDir, setSelectedSceneId } =
    useAppState();

  const [shot, setShot] = useState<Shot | null>(null);
  const [positive, setPositive] = useState("");
  const [negative, setNegative] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [message, setMessage] = useState("");
  const [attachRole, setAttachRole] = useState<AttachmentRole>("reference");
  const [workflowScope, setWorkflowScope] = useState<"global" | "project">(
    "global",
  );
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [variantPath, setVariantPath] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [diffTitle, setDiffTitle] = useState<string>("");

  const shotDirArgs = useMemo(() => {
    if (!projectDir || !sceneId || !shotId) return null;
    return { project_dir: projectDir, scene_id: sceneId, shot_id: shotId };
  }, [projectDir, sceneId, shotId]);

  useEffect(() => {
    if (!projectDir) return;
    setWorkspaceScope("project");
    setCurrentProjectDir(projectDir);
    setSelectedSceneId(sceneId);
  }, [projectDir, sceneId, setCurrentProjectDir, setSelectedSceneId, setWorkspaceScope]);

  useEffect(() => {
    if (!shotDirArgs) return;
    setErr(null);
    setBusy(true);
    Promise.all([
      cmd<Shot>("read_shot", shotDirArgs),
      cmd<string>("read_prompt_text", { ...shotDirArgs, kind: "positive" }),
      cmd<string>("read_prompt_text", { ...shotDirArgs, kind: "negative" }),
      cmd<Revision[]>("list_revisions", shotDirArgs),
    ])
      .then(([s, p, n, r]) => {
        setShot(s);
        setPositive(p);
        setNegative(n);
        setRevisions(r);
        if (s.workflowRef?.workflowId) {
          setWorkflowScope(s.workflowRef.scope);
          setSelectedWorkflowId(s.workflowRef.workflowId);
        }
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setBusy(false));
  }, [shotDirArgs]);

  useEffect(() => {
    if (!projectDir) return;
    const projectArg = workflowScope === "project" ? projectDir : null;
    cmd<WorkflowSummary[]>("list_workflows", {
      scope: workflowScope,
      project_dir: projectArg,
    })
      .then(setWorkflows)
      .catch(() => setWorkflows([]));
  }, [projectDir, workflowScope]);

  async function saveShot() {
    if (!shotDirArgs || !shot) return;
    setErr(null);
    setBusy(true);
    try {
      const updated = await cmd<Shot>("update_shot_fields", {
        ...shotDirArgs,
        shot: { ...shot, updatedAt: new Date().toISOString() },
      });
      setShot(updated);
      await cmd<void>("write_prompt_text", {
        ...shotDirArgs,
        kind: "positive",
        text: positive,
      });
      await cmd<void>("write_prompt_text", {
        ...shotDirArgs,
        kind: "negative",
        text: negative,
      });
      const r = await cmd<Revision[]>("list_revisions", shotDirArgs);
      setRevisions(r);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveRevision() {
    if (!shotDirArgs) return;
    setErr(null);
    setBusy(true);
    try {
      await cmd<void>("create_revision", { ...shotDirArgs, message: message || null });
      setMessage("");
      const r = await cmd<Revision[]>("list_revisions", shotDirArgs);
      setRevisions(r);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function restoreRevision(dirName: string) {
    if (!shotDirArgs) return;
    setErr(null);
    setBusy(true);
    try {
      await cmd<void>("restore_revision", { ...shotDirArgs, revision_dir_name: dirName });
      const [s, p, n] = await Promise.all([
        cmd<Shot>("read_shot", shotDirArgs),
        cmd<string>("read_prompt_text", { ...shotDirArgs, kind: "positive" }),
        cmd<string>("read_prompt_text", { ...shotDirArgs, kind: "negative" }),
      ]);
      setShot(s);
      setPositive(p);
      setNegative(n);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadDiff(dirName: string) {
    if (!shotDirArgs) return;
    setErr(null);
    setBusy(true);
    try {
      const d = await cmd<DiffResult>("diff_revision", {
        ...shotDirArgs,
        revision_dir_name: dirName,
      });
      setDiffTitle(new Date().toLocaleString());
      setDiff(d);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    await writeText(text);
  }

  async function importAttachments() {
    if (!projectDir || !shotDirArgs) return;
    setErr(null);
    setBusy(true);
    try {
      const selected = await openDialog({
        multiple: true,
        title: "Select attachments",
      });
      const files = Array.isArray(selected)
        ? selected
        : selected
          ? [selected]
          : [];
      if (files.length === 0) return;
      const updated = await cmd<Shot>("import_attachments", {
        ...shotDirArgs,
        files,
        role: attachRole,
      });
      setShot(updated);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyWorkflow() {
    if (!projectDir || !shotDirArgs || !shotId || !selectedWorkflowId.trim())
      return;
    setErr(null);
    setBusy(true);
    setVariantPath(null);
    try {
      const mapping: Record<string, string> = {
        positive,
        negative,
        seed: String(shot?.params.seed ?? ""),
        steps: String(shot?.params.steps ?? ""),
        cfg: String(shot?.params.cfg ?? ""),
        width: String(shot?.params.width ?? ""),
        height: String(shot?.params.height ?? ""),
      };
      const out = await cmd<string>("apply_workflow_template", {
        project_dir: projectDir,
        scope: workflowScope,
        workflow_id: selectedWorkflowId,
        shot_id: shotId,
        mapping,
      });
      setVariantPath(out);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!shotDirArgs) {
    return (
      <div className="p-4 max-w-4xl">
        <div className="text-lg font-semibold text-fg">Shot</div>
        <div className="mt-2 text-sm text-muted">
          Missing project/scene/shot parameters.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl">
      {diff && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4">
          <div className="mx-auto max-w-5xl h-full rounded-lg border border-border bg-surface flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-fg">
                Revision diff
              </div>
              <Button variant="secondary" onClick={() => setDiff(null)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <div className="text-xs font-medium text-muted-2">
                  Positive prompt diff
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-muted rounded-md border border-border bg-surface p-3">
                  {diff.positive || "No changes"}
                </pre>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-2">
                  Negative prompt diff
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-muted rounded-md border border-border bg-surface p-3">
                  {diff.negative || "No changes"}
                </pre>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-2">
                  Shot metadata diff
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-muted rounded-md border border-border bg-surface p-3">
                  {diff.shotJson || "No changes"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => nav("/project")}
              disabled={busy}
            >
              Back to shots
            </Button>
            <div className="text-lg font-semibold text-fg">
              Shot {shot ? String(shot.number).padStart(3, "0") : ""}
            </div>
          </div>
          <div className="mt-1 text-sm text-muted">
            {busy ? "Working…" : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={saveShot} disabled={busy || !shot}>
            Save
          </Button>
            <Button
              variant="secondary"
              onClick={() => open(projectDir!)}
              disabled={busy}
            >
              Open folder
            </Button>
        </div>
      </div>

      {err && (
        <div className="mt-3 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-fg">
          {err}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-fg">
                  Positive prompt
                </div>
                <Button variant="secondary" onClick={() => copy(positive)}>
                  Copy
                </Button>
              </div>
              <div className="mt-2">
                <Textarea
                  value={positive}
                  onChange={setPositive}
                  placeholder="Write a positive prompt."
                  rows={14}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-fg">
                  Negative prompt
                </div>
                <Button variant="secondary" onClick={() => copy(negative)}>
                  Copy
                </Button>
              </div>
              <div className="mt-2">
                <Textarea
                  value={negative}
                  onChange={setNegative}
                  placeholder="Write a negative prompt."
                  rows={14}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="text-sm font-semibold text-fg">Metadata</div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-muted-2">Title</div>
                <div className="mt-1">
                  <Input
                    value={shot?.title ?? ""}
                    onChange={(v) =>
                      setShot((s) => (s ? { ...s, title: v } : s))
                    }
                  />
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-2">Status</div>
                <div className="mt-1">
                  <select
                    value={shot?.status ?? "Todo"}
                    onChange={(e) =>
                      setShot((s) =>
                        s ? { ...s, status: e.target.value as any } : s,
                      )
                    }
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
                  >
                    <option value="Todo">Todo</option>
                    <option value="InProgress">In progress</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs font-medium text-muted-2">Width</div>
                <div className="mt-1">
                  <Input
                    value={String(shot?.params.width ?? "")}
                    onChange={(v) =>
                      setShot((s) =>
                        s
                          ? {
                              ...s,
                              params: {
                                ...s.params,
                                width: v.trim() ? Number(v) : undefined,
                              },
                            }
                          : s,
                      )
                    }
                    placeholder="1024"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-2">Height</div>
                <div className="mt-1">
                  <Input
                    value={String(shot?.params.height ?? "")}
                    onChange={(v) =>
                      setShot((s) =>
                        s
                          ? {
                              ...s,
                              params: {
                                ...s.params,
                                height: v.trim() ? Number(v) : undefined,
                              },
                            }
                          : s,
                      )
                    }
                    placeholder="576"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-2">Seed</div>
                <div className="mt-1">
                  <Input
                    value={String(shot?.params.seed ?? "")}
                    onChange={(v) =>
                      setShot((s) =>
                        s
                          ? {
                              ...s,
                              params: {
                                ...s.params,
                                seed: v.trim() ? Number(v) : undefined,
                              },
                            }
                          : s,
                      )
                    }
                    placeholder="12345"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-2">Steps</div>
                <div className="mt-1">
                  <Input
                    value={String(shot?.params.steps ?? "")}
                    onChange={(v) =>
                      setShot((s) =>
                        s
                          ? {
                              ...s,
                              params: {
                                ...s.params,
                                steps: v.trim() ? Number(v) : undefined,
                              },
                            }
                          : s,
                      )
                    }
                    placeholder="25"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-2">CFG</div>
                <div className="mt-1">
                  <Input
                    value={String(shot?.params.cfg ?? "")}
                    onChange={(v) =>
                      setShot((s) =>
                        s
                          ? {
                              ...s,
                              params: {
                                ...s.params,
                                cfg: v.trim() ? Number(v) : undefined,
                              },
                            }
                          : s,
                      )
                    }
                    placeholder="5.5"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-2">
                  Sampler
                </div>
                <div className="mt-1">
                  <Input
                    value={shot?.params.sampler ?? ""}
                    onChange={(v) =>
                      setShot((s) =>
                        s
                          ? {
                              ...s,
                              params: { ...s.params, sampler: v || undefined },
                            }
                          : s,
                      )
                    }
                    placeholder="euler_a"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-fg">
                Attachments
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={attachRole}
                  onChange={(e) => setAttachRole(e.target.value as AttachmentRole)}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
                >
                  <option value="first_frame">First frame</option>
                  <option value="last_frame">Last frame</option>
                  <option value="reference">Reference</option>
                  <option value="result">Result</option>
                  <option value="other">Other</option>
                </select>
                <Button variant="secondary" onClick={importAttachments} disabled={busy}>
                  Import
                </Button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {(shot?.attachments ?? []).map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border border-border bg-surface px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-medium text-fg">
                      {a.fileName}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        const full = await join(projectDir!, a.relPath);
                        await open(full);
                      }}
                    >
                      Open
                    </Button>
                  </div>
                  <div className="mt-1 text-xs text-muted-2">
                    {a.role.replace("_", " ")} • {a.kind}
                  </div>
                </div>
              ))}
              {(shot?.attachments ?? []).length === 0 && (
                <div className="text-sm text-muted">
                  No attachments yet.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-fg">
                Workflow
              </div>
              <Button variant="secondary" onClick={applyWorkflow} disabled={busy}>
                Apply template
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-muted-2">Scope</div>
                <div className="mt-1">
                  <select
                    value={workflowScope}
                    onChange={(e) => {
                      const next = e.target.value as "global" | "project";
                      setWorkflowScope(next);
                      setSelectedWorkflowId("");
                      setShot((s) =>
                        s
                          ? {
                              ...s,
                              workflowRef: null,
                            }
                          : s,
                      );
                    }}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
                  >
                    <option value="global">Global</option>
                    <option value="project">Project</option>
                  </select>
                </div>
                <div className="mt-1 text-xs text-muted-2">
                  Project workflows are stored in the project folder.
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-2">
                  Workflow
                </div>
                <div className="mt-1">
                  <select
                    value={selectedWorkflowId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedWorkflowId(id);
                      setShot((s) =>
                        s
                          ? {
                              ...s,
                              workflowRef: id
                                ? { scope: workflowScope, workflowId: id }
                                : null,
                            }
                          : s,
                      );
                    }}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
                  >
                    <option value="">Select a workflow</option>
                    {workflows.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {variantPath && (
              <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted">
                <div className="text-xs font-medium text-muted-2">
                  Variant saved
                </div>
                <div className="mt-1 break-all">{variantPath}</div>
                <div className="mt-2">
                  <Button
                    variant="secondary"
                    onClick={() => open(variantPath)}
                  >
                    Open file
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-sm font-semibold text-fg">History</div>
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-muted-2">
              Save revision message
            </div>
            <Input value={message} onChange={setMessage} placeholder="Optional message" />
            <Button onClick={saveRevision} disabled={busy}>
              Save revision
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {revisions.map((r) => (
              <div
                key={r.id}
                className="rounded-md border border-border bg-surface px-3 py-2"
              >
                <div className="text-sm font-medium text-fg">
                  {new Date(r.createdAt).toLocaleString()}
                </div>
                <div className="mt-1 text-sm text-muted">
                  {r.message ?? "No message"}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => restoreRevision(r.dirName)}
                    disabled={busy}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => loadDiff(r.dirName)}
                    disabled={busy}
                  >
                    Diff
                  </Button>
                </div>
              </div>
            ))}
            {revisions.length === 0 && (
              <div className="text-sm text-muted">No revisions.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
