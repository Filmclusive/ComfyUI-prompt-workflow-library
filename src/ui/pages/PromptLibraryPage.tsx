import { useEffect, useMemo, useState } from "react";
import { cmd } from "../../lib/tauri";
import type { PromptEntry, PromptEntryFormat, PromptParams, PromptScope } from "../../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { useAppState } from "../../state/AppState";

type AdvancedParamsDraft = {
  width: string;
  height: string;
  seed: string;
  steps: string;
  cfg: string;
  sampler: string;
  modelName: string;
  vae: string;
};

const EMPTY_ADVANCED: AdvancedParamsDraft = {
  width: "",
  height: "",
  seed: "",
  steps: "",
  cfg: "",
  sampler: "",
  modelName: "",
  vae: "",
};

function isAdvanced(p: PromptEntry): boolean {
  return (
    p.format === "advanced" ||
    p.format === "dual" ||
    !!p.positive ||
    !!p.negative ||
    !!p.params
  );
}

function toAdvancedDraft(params?: PromptParams | null): AdvancedParamsDraft {
  return {
    width: params?.width != null ? String(params.width) : "",
    height: params?.height != null ? String(params.height) : "",
    seed: params?.seed != null ? String(params.seed) : "",
    steps: params?.steps != null ? String(params.steps) : "",
    cfg: params?.cfg != null ? String(params.cfg) : "",
    sampler: params?.sampler ?? "",
    modelName: params?.modelName ?? "",
    vae: params?.vae ?? "",
  };
}

function parseAdvancedParams(d: AdvancedParamsDraft): PromptParams | null {
  const int = (v: string): number | undefined => {
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return undefined;
    if (!Number.isInteger(parsed)) return undefined;
    if (parsed < 0) return undefined;
    return parsed;
  };
  const float = (v: string): number | undefined => {
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
  };
  const out: PromptParams = {
    width: int(d.width),
    height: int(d.height),
    seed: int(d.seed),
    steps: int(d.steps),
    cfg: float(d.cfg),
    sampler: d.sampler.trim() ? d.sampler.trim() : undefined,
    modelName: d.modelName.trim() ? d.modelName.trim() : undefined,
    vae: d.vae.trim() ? d.vae.trim() : undefined,
  };
  const hasAny =
    out.width != null ||
    out.height != null ||
    out.seed != null ||
    out.steps != null ||
    out.cfg != null ||
    !!out.sampler ||
    !!out.modelName ||
    !!out.vae;
  return hasAny ? out : null;
}

function describeAdvancedParams(p: PromptEntry): string | null {
  const params = p.params ?? null;
  if (!params) return null;
  const parts: string[] = [];
  if (params.width && params.height) parts.push(`${params.width}×${params.height}`);
  else if (params.width) parts.push(`w ${params.width}`);
  else if (params.height) parts.push(`h ${params.height}`);
  if (params.seed != null) parts.push(`seed ${params.seed}`);
  if (params.steps != null) parts.push(`steps ${params.steps}`);
  if (params.cfg != null) parts.push(`cfg ${params.cfg}`);
  if (params.sampler) parts.push(params.sampler);
  if (params.modelName) parts.push(params.modelName);
  if (params.vae) parts.push(`vae ${params.vae}`);
  return parts.length ? parts.join(" · ") : null;
}

export function PromptLibraryPage() {
  const { currentProjectDir, workspaceScope } = useAppState();
  const [items, setItems] = useState<PromptEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [format, setFormat] = useState<PromptEntryFormat>("simple");
  const [positive, setPositive] = useState("");
  const [negative, setNegative] = useState("");
  const [advancedParams, setAdvancedParams] =
    useState<AdvancedParamsDraft>(EMPTY_ADVANCED);
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
      const advanced = format === "advanced" || format === "dual";
      await cmd<PromptEntry>("create_prompt_entry", {
        scope,
        parent_dir: resolvedParentDir,
        parent_id: null,
        title,
        body,
        format: advanced ? "advanced" : "simple",
        positive: advanced ? positive : null,
        negative: advanced ? negative : null,
        params: advanced ? parseAdvancedParams(advancedParams) : null,
        tags: [],
        kind: "both",
      });
      resetForm();
      await refresh();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function update() {
    if (!editingId) return;
    setBusy(true);
    setErr(null);
    try {
      const advanced = format === "advanced" || format === "dual";
      const original = items.find((i) => i.id === editingId) ?? null;
      await cmd<PromptEntry>("update_prompt_entry", {
        scope,
        parent_dir: resolvedParentDir,
        id: editingId,
        title,
        body,
        format: advanced ? "advanced" : "simple",
        positive: advanced ? positive : null,
        negative: advanced ? negative : null,
        params: advanced ? parseAdvancedParams(advancedParams) : null,
        tags: original?.tags ?? [],
        kind: original?.kind ?? "both",
      });
      resetForm();
      await refresh();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setFormat("simple");
    setPositive("");
    setNegative("");
    setAdvancedParams(EMPTY_ADVANCED);
  }

  function startEdit(p: PromptEntry) {
    setEditingId(p.id);
    setTitle(p.title ?? "");
    setBody(p.body ?? "");
    const nextFormat: PromptEntryFormat =
      isAdvanced(p) ? "advanced" : "simple";
    setFormat(nextFormat);
    setPositive(p.positive ?? "");
    setNegative(p.negative ?? "");
    setAdvancedParams(toAdvancedDraft(p.params));
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
            {editingId ? "Edit prompt" : "Create prompt"}
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <div className="text-xs font-medium text-muted-2">Type</div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Button
                  variant={format === "simple" ? "primary" : "secondary"}
                  onClick={() => setFormat("simple")}
                  disabled={busy}
                >
                  Simple
                </Button>
                <Button
                  variant={
                    format === "advanced" || format === "dual"
                      ? "primary"
                      : "secondary"
                  }
                  onClick={() => setFormat("advanced")}
                  disabled={busy}
                >
                  Advanced
                </Button>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-2">Title</div>
              <div className="mt-1">
                <Input value={title} onChange={setTitle} />
              </div>
            </div>
            {format === "simple" ? (
              <div>
                <div className="text-xs font-medium text-muted-2">Body</div>
                <div className="mt-1">
                  <Textarea value={body} onChange={setBody} rows={10} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium text-muted-2">
                      Positive
                    </div>
                    <div className="mt-1">
                      <Textarea
                        value={positive}
                        onChange={setPositive}
                        placeholder="Write a positive prompt."
                        rows={10}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-2">
                      Negative
                    </div>
                    <div className="mt-1">
                      <Textarea
                        value={negative}
                        onChange={setNegative}
                        placeholder="Write a negative prompt."
                        rows={10}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-medium text-muted-2">Width</div>
                    <div className="mt-1">
                      <Input
                        value={advancedParams.width}
                        onChange={(v) =>
                          setAdvancedParams((s) => ({ ...s, width: v }))
                        }
                        placeholder="1024"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-2">Height</div>
                    <div className="mt-1">
                      <Input
                        value={advancedParams.height}
                        onChange={(v) =>
                          setAdvancedParams((s) => ({ ...s, height: v }))
                        }
                        placeholder="576"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-2">Seed</div>
                    <div className="mt-1">
                      <Input
                        value={advancedParams.seed}
                        onChange={(v) =>
                          setAdvancedParams((s) => ({ ...s, seed: v }))
                        }
                        placeholder="12345"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-2">Steps</div>
                    <div className="mt-1">
                      <Input
                        value={advancedParams.steps}
                        onChange={(v) =>
                          setAdvancedParams((s) => ({ ...s, steps: v }))
                        }
                        placeholder="25"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-2">CFG</div>
                    <div className="mt-1">
                      <Input
                        value={advancedParams.cfg}
                        onChange={(v) =>
                          setAdvancedParams((s) => ({ ...s, cfg: v }))
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
                        value={advancedParams.sampler}
                        onChange={(v) =>
                          setAdvancedParams((s) => ({ ...s, sampler: v }))
                        }
                        placeholder="euler_a"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs font-medium text-muted-2">
                      Model
                    </div>
                    <div className="mt-1">
                      <Input
                        value={advancedParams.modelName}
                        onChange={(v) =>
                          setAdvancedParams((s) => ({ ...s, modelName: v }))
                        }
                        placeholder="model name"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-2">VAE</div>
                    <div className="mt-1">
                      <Input
                        value={advancedParams.vae}
                        onChange={(v) =>
                          setAdvancedParams((s) => ({ ...s, vae: v }))
                        }
                        placeholder="vae name"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                onClick={editingId ? update : create}
                disabled={
                  busy ||
                  !title.trim() ||
                  (workspaceScope === "project" && !currentProjectDir)
                }
              >
                {editingId ? "Save changes" : "Create"}
              </Button>
              {editingId && (
                <Button variant="secondary" onClick={resetForm} disabled={busy}>
                  Cancel
                </Button>
              )}
            </div>
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
            {items.map((p) => {
              const advanced = isAdvanced(p);
              const summary = advanced ? describeAdvancedParams(p) : null;
              return (
                <div
                  key={p.id}
                  className="rounded-md border border-border bg-surface px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-fg">
                        {p.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-2">
                        {advanced ? "Advanced" : "Simple"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => startEdit(p)}
                        disabled={busy}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => remove(p.id)}
                        disabled={busy}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {advanced ? (
                    <div className="mt-2 space-y-2">
                      {summary && (
                        <div className="text-xs text-muted-2">{summary}</div>
                      )}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <div className="text-xs font-medium text-muted-2">
                            Positive
                          </div>
                          <div className="mt-1 text-sm text-muted whitespace-pre-wrap">
                            {p.positive ?? ""}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-muted-2">
                            Negative
                          </div>
                          <div className="mt-1 text-sm text-muted whitespace-pre-wrap">
                            {p.negative ?? ""}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-muted whitespace-pre-wrap">
                      {p.body}
                    </div>
                  )}
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="text-sm text-muted">No prompts yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
