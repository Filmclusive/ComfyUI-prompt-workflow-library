import { useEffect, useMemo, useRef, useState } from "react";
import { writeText } from "@tauri-apps/api/clipboard";
import { cmd } from "../../lib/tauri";
import type { PromptEntry, PromptEntryFormat, PromptParams, PromptScope } from "../../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { Textarea } from "../components/Textarea";
import {
  ASPECT_RATIO_PRESETS,
  findAspectRatioPresetByDimensions,
} from "../data/aspectRatioPresets";
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

function parseDimension(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return undefined;
  return parsed;
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
  const [selectedAspectPresetId, setSelectedAspectPresetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [expandedAll, setExpandedAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const resolvedParentDir = useMemo(() => {
    if (workspaceScope === "global") return null;
    if (currentProjectDir) return currentProjectDir;
    return null;
  }, [workspaceScope, currentProjectDir]);

  const scope: PromptScope = workspaceScope === "global" ? "global" : "project";

  const parsedAdvancedWidth = useMemo(
    () => parseDimension(advancedParams.width),
    [advancedParams.width],
  );
  const parsedAdvancedHeight = useMemo(
    () => parseDimension(advancedParams.height),
    [advancedParams.height],
  );
  const matchedPreset = useMemo(
    () =>
      findAspectRatioPresetByDimensions(parsedAdvancedWidth, parsedAdvancedHeight),
    [parsedAdvancedHeight, parsedAdvancedWidth],
  );

  useEffect(() => {
    const target = matchedPreset?.id ?? "";
    if (target !== selectedAspectPresetId) {
      setSelectedAspectPresetId(target);
    }
  }, [matchedPreset?.id, selectedAspectPresetId]);

  const applyAspectRatioPreset = (presetId: string) => {
    setSelectedAspectPresetId(presetId);
    if (!presetId) return;
    const preset = ASPECT_RATIO_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setAdvancedParams((s) => ({
      ...s,
      width: String(preset.width),
      height: String(preset.height),
    }));
  };

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
      setEditorOpen(false);
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
      setEditorOpen(false);
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

  function openCreateDialog() {
    resetForm();
    setEditorOpen(true);
  }

  function openEditDialog(p: PromptEntry) {
    startEdit(p);
    setEditorOpen(true);
  }

  async function copy(text: string) {
    await writeText(text);
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

  const canManagePrompts =
    !(workspaceScope === "project" && !currentProjectDir);

  const PromptEditor = (
    <div className="space-y-3">
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
          <div>
            <div className="text-xs font-medium text-muted-2">Positive</div>
            <div className="mt-1">
              <Textarea
                value={positive}
                onChange={setPositive}
                placeholder="Write a positive prompt."
                rows={8}
              />
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-2">Negative</div>
            <div className="mt-1">
              <Textarea
                value={negative}
                onChange={setNegative}
                placeholder="Write a negative prompt."
                rows={8}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted-2">
              Aspect ratio preset
            </div>
            <div className="mt-1">
              <select
                value={selectedAspectPresetId}
                onChange={(e) => applyAspectRatioPreset(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
              >
                <option value="">Manual / custom</option>
                {ASPECT_RATIO_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                    {preset.description ? ` · ${preset.description}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div className="text-xs font-medium text-muted-2">Sampler</div>
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
            <div className="sm:col-span-2">
              <div className="text-xs font-medium text-muted-2">Model</div>
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
            <div className="sm:col-span-2">
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
            !canManagePrompts
          }
        >
          {editingId ? "Save changes" : "Create"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setEditorOpen(false);
            resetForm();
          }}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </div>
  );

  function PromptActionsMenu({
    onEdit,
    onDelete,
    disabled,
  }: {
    onEdit: () => void;
    onDelete: () => void;
    disabled?: boolean;
  }) {
    const ref = useRef<HTMLDetailsElement | null>(null);

    const close = () => {
      ref.current?.removeAttribute("open");
    };

    return (
      <details
        ref={ref}
        className="relative shrink-0 [&[open]]:z-50"
      >
        <summary
          aria-label="Prompt actions"
          onClick={(e) => e.stopPropagation()}
          className={[
            "cursor-pointer select-none rounded-md border border-border bg-surface px-2 py-1 text-sm text-muted",
            "hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-accent-ring",
            "list-none [&::-webkit-details-marker]:hidden [&::marker]:content-['']",
            disabled ? "opacity-60 pointer-events-none" : "",
          ].join(" ")}
        >
          <span aria-hidden="true">⋯</span>
        </summary>
        <div className="absolute right-0 mt-1 z-50 w-40 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface-hover focus:outline-none focus:bg-surface-hover"
            onClick={(e) => {
              e.stopPropagation();
              close();
              onEdit();
            }}
            disabled={disabled}
          >
            Edit
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-danger-fg hover:bg-surface-hover focus:outline-none focus:bg-surface-hover"
            onClick={(e) => {
              e.stopPropagation();
              close();
              onDelete();
            }}
            disabled={disabled}
          >
            Delete
          </button>
        </div>
      </details>
    );
  }

  return (
    <div className="p-4 w-full max-w-lg mx-auto min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-fg">Prompt library</div>
          <div className="mt-2 text-sm text-muted">
            {workspaceScope === "global"
              ? "Global prompts are available across all projects."
              : "Project prompts apply to the selected project."}
          </div>
        </div>
        <div className="flex items-center">
          <Button
            variant="secondary"
            onClick={openCreateDialog}
            disabled={busy || !canManagePrompts}
            className="px-3 py-2"
          >
            New +
          </Button>
        </div>
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

      <div className="mt-6 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="text-sm font-semibold text-fg">Saved</div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setExpandedAll((v) => !v);
                setExpandedId(null);
              }}
              disabled={busy}
              className="px-3 py-2"
            >
              {expandedAll ? "Collapse" : "View all"}
            </Button>
            <div className="text-xs text-muted-2">{busy ? "Loading…" : ""}</div>
          </div>
        </div>
        <div className="mt-2 space-y-2">
          {items.map((p) => {
            const advanced = isAdvanced(p);
            const summary = advanced ? describeAdvancedParams(p) : null;
            const preview = advanced
              ? (p.positive ?? "").trim() || (p.negative ?? "").trim()
              : (p.body ?? "").trim();
            const expanded = expandedAll || expandedId === p.id;
            return (
              <div
                key={p.id}
                className="w-full rounded-md border border-border bg-surface"
              >
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-accent-ring"
                  onClick={() => {
                    if (expandedAll) return;
                    setExpandedId((prev) => (prev === p.id ? null : p.id));
                  }}
                  disabled={busy}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-sm font-medium text-fg truncate">
                          {p.title || "Untitled"}
                        </div>
                        <div className="shrink-0 text-xs text-muted-2">
                          {advanced ? "Advanced" : "Simple"}
                        </div>
                      </div>
	                      {summary && (
	                        <div className="mt-1 text-xs text-muted-2 truncate">
	                          {summary}
	                        </div>
	                      )}
	                      {!expanded && preview && (
	                        <div className="mt-1 text-xs text-muted-2 fc-line-clamp-2">
	                          {preview}
	                        </div>
	                      )}
	                    </div>

                    <div
	                      className="shrink-0 flex items-center gap-2"
	                      onClick={(e) => e.stopPropagation()}
	                    >
	                      {!expanded ? (
	                        <Button
	                          variant="secondary"
	                          className="px-2 py-1 text-xs"
	                          disabled={busy}
	                          onClick={() => {
	                            if (advanced) {
	                              void copy(
	                                `Positive:\n${p.positive ?? ""}\n\nNegative:\n${p.negative ?? ""}`,
	                              );
	                              return;
	                            }
	                            void copy(p.body ?? "");
	                          }}
	                        >
	                          Copy
	                        </Button>
	                      ) : advanced ? (
	                        <>
	                          <Button
	                            variant="secondary"
	                            className="px-2 py-1 text-xs"
	                            disabled={busy}
	                            onClick={() => void copy(p.positive ?? "")}
	                          >
	                            Copy +
	                          </Button>
	                          <Button
	                            variant="secondary"
	                            className="px-2 py-1 text-xs"
	                            disabled={busy}
	                            onClick={() => void copy(p.negative ?? "")}
	                          >
	                            Copy -
	                          </Button>
	                          <Button
	                            variant="secondary"
	                            className="px-2 py-1 text-xs"
	                            disabled={busy}
	                            onClick={() =>
	                              void copy(
	                                `Positive:\n${p.positive ?? ""}\n\nNegative:\n${p.negative ?? ""}`,
	                              )
	                            }
	                          >
	                            Copy +/-
	                          </Button>
	                        </>
	                      ) : (
	                        <Button
	                          variant="secondary"
	                          className="px-2 py-1 text-xs"
	                          disabled={busy}
	                          onClick={() => void copy(p.body ?? "")}
	                        >
	                          Copy
	                        </Button>
	                      )}

	                      <PromptActionsMenu
	                        disabled={busy || !canManagePrompts}
	                        onEdit={() => openEditDialog(p)}
                        onDelete={async () => remove(p.id)}
                      />
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="px-3 pb-3 pt-1">
                    {advanced ? (
                      <div className="space-y-3">
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
                    ) : (
                      <div>
                        <div className="text-xs font-medium text-muted-2">
                          Body
                        </div>
                        <div className="mt-1 text-sm text-muted whitespace-pre-wrap">
                          {p.body ?? ""}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="rounded-md border border-border bg-surface px-3 py-3 text-sm text-muted">
              No prompts yet. Create your first prompt with the plus button.
            </div>
          )}
        </div>
      </div>

      {items.length === 0 && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <div className="text-sm font-semibold text-fg">Create prompt</div>
          <div className="mt-3">{PromptEditor}</div>
        </div>
      )}

      <Modal
        open={editorOpen}
        title={editingId ? "Edit prompt" : "Create prompt"}
        size="sm"
        onClose={() => {
          if (busy) return;
          setEditorOpen(false);
          resetForm();
        }}
      >
        {PromptEditor}
      </Modal>
    </div>
  );
}
