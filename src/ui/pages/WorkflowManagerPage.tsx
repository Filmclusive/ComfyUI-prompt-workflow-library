import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cmd } from "../../lib/tauri";
import type { WorkflowSummary } from "../../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { useAppState } from "../../state/AppState";
import { open } from "@tauri-apps/api/dialog";
import { appWindow } from "@tauri-apps/api/window";
import { writeText } from "@tauri-apps/api/clipboard";
import filmclusiveIcon from "../../assets/filmclusive-app-icon.png";

const workflowTypeOptions = [
  { value: "all", label: "All types" },
  { value: "textToImage", label: "Text to image" },
  { value: "imageToImage", label: "Image to image" },
  { value: "videoToVideo", label: "Video to video" },
  { value: "motionCapture", label: "Motion capture" },
  { value: "textToVideo", label: "Text to video" },
  { value: "other", label: "Other" },
] as const;

const loraFilterOptions = [
  { value: "all", label: "Any LoRA" },
  { value: "with", label: "With LoRA" },
  { value: "without", label: "Without LoRA" },
] as const;

type WorkflowTypeFilter = (typeof workflowTypeOptions)[number]["value"];
type LoraFilter = (typeof loraFilterOptions)[number]["value"];

export function WorkflowManagerPage() {
  const { currentProjectDir, workspaceScope, settings } = useAppState();
  const [items, setItems] = useState<WorkflowSummary[]>([]);
  const [title, setTitle] = useState("New workflow");
  const [jsonPath, setJsonPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [selected, setSelected] = useState<WorkflowSummary | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<ReactNode | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [modelFilter, setModelFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] =
    useState<"all" | "approved" | "custom">("all");
  const [typeFilter, setTypeFilter] = useState<WorkflowTypeFilter>("all");
  const [loraFilter, setLoraFilter] = useState<LoraFilter>("all");

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
      setImportOpen(false);
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

  const availableModels = useMemo(() => {
    const models = new Set<string>();
    items.forEach((w) => {
      getModelNames(w.tags).forEach((model) => models.add(model));
    });
    return Array.from(models).sort((a, b) => a.localeCompare(b));
  }, [items]);

  useEffect(() => {
    if (modelFilter === "all") return;
    if (!availableModels.includes(modelFilter)) {
      setModelFilter("all");
    }
  }, [modelFilter, availableModels]);

  const filteredItems = useMemo(() => {
    return items.filter((w) => {
      const models = getModelNames(w.tags);
      const matchesModel =
        modelFilter === "all" || models.includes(modelFilter);
      const isApproved = w.tags.includes("filmclusive-approved");
      const matchesApproval =
        approvalFilter === "all" ||
        (approvalFilter === "approved" && isApproved) ||
        (approvalFilter === "custom" && !isApproved);
      const workflowType = getWorkflowType(w);
      const matchesType = typeFilter === "all" || workflowType === typeFilter;
      const usesLoRA = workflowUsesLoRA(w);
      const matchesLoRA =
        loraFilter === "all" ||
        (loraFilter === "with" && usesLoRA) ||
        (loraFilter === "without" && !usesLoRA);
      return matchesModel && matchesApproval && matchesType && matchesLoRA;
    });
  }, [items, modelFilter, approvalFilter, typeFilter, loraFilter]);

  const approved = useMemo(
    () => filteredItems.filter((w) => w.tags.includes("filmclusive-approved")),
    [filteredItems],
  );
  const custom = useMemo(
    () => filteredItems.filter((w) => !w.tags.includes("filmclusive-approved")),
    [filteredItems],
  );

  const comfyUiConfigured = Boolean(
    settings?.comfyui.appPath?.trim(),
  );

  function getModelNames(tags: string[]) {
    return tags
      .filter((t) => t.startsWith("model:"))
      .map((t) => t.slice("model:".length))
      .filter(Boolean);
  }

  function deriveWorkflowTypeFromTag(tags: string[]): WorkflowTypeFilter | null {
    for (const tag of tags) {
      const lower = tag.toLowerCase();
      if (!lower.startsWith("type:")) continue;
      const value = lower.slice("type:".length);
      if (value.includes("text") && value.includes("image")) {
        return "textToImage";
      }
      if (value.includes("image") && value.includes("image")) {
        return "imageToImage";
      }
      if (value.includes("text") && value.includes("video")) {
        return "textToVideo";
      }
      if (value.includes("video")) {
        return "videoToVideo";
      }
      if (value.includes("motion")) {
        return "motionCapture";
      }
    }
    return null;
  }

  function getWorkflowType(w: WorkflowSummary): WorkflowTypeFilter {
    const fromTag = deriveWorkflowTypeFromTag(w.tags);
    if (fromTag) {
      return fromTag;
    }
    const title = w.title.toLowerCase();
    const matches = (keywords: string[]) => keywords.some((kw) => title.includes(kw));
    if (matches(["text to image", "text-to-image", "text2image", "text to image"])) {
      return "textToImage";
    }
    if (
      matches([
        "image to image",
        "image (edit)",
        "image edit",
        "img2img",
        "image->image",
      ])
    ) {
      return "imageToImage";
    }
    if (matches(["text to video", "text-to-video", "text2video"])) {
      return "textToVideo";
    }
    if (matches(["video", "wan"]) && !matches(["motion"])) {
      return "videoToVideo";
    }
    if (matches(["motion capture", "motion", "mocap"])) {
      return "motionCapture";
    }
    return "other";
  }

  function workflowUsesLoRA(w: WorkflowSummary) {
    const title = w.title.toLowerCase();
    return (
      w.tags.some((tag) => tag.toLowerCase().includes("lora")) ||
      title.includes("lora")
    );
  }

  function formatUpdatedDate(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  }

  function renderWorkflowItem(w: WorkflowSummary) {
    const models = getModelNames(w.tags);
    const modelLabel = models.length ? models.join(", ") : null;
    const updatedLabel = formatUpdatedDate(w.updatedAt);
    const isApproved = w.tags.includes("filmclusive-approved");

    return (
      <button
        type="button"
        key={w.id}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-left hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-accent-ring"
        onClick={() => {
          setSelected(w);
          setActionErr(null);
          setActionNotice(null);
        }}
      >
        <div className="flex items-start gap-3 min-w-0">
          {isApproved && (
            <img
              src={filmclusiveIcon}
              alt="Filmclusive icon"
              className="h-5 w-5 flex-shrink-0 rounded-md object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-fg truncate">
              {w.title}
            </div>
            {modelLabel && (
              <div className="mt-1 text-xs font-medium text-muted-2 truncate">
                {modelLabel}
              </div>
            )}
            <div className="mt-1 text-xs text-muted-2">
              Updated {updatedLabel}
            </div>
          </div>
        </div>
      </button>
    );
  }

  async function copyWorkflowJson(w: WorkflowSummary) {
    setActionBusy(true);
    setActionErr(null);
    setActionNotice(null);
    try {
      const projectDir = scope === "project" ? resolvedProjectDir : null;
      const json = await cmd<string>("get_workflow_json", {
        scope,
        project_dir: projectDir,
        workflow_id: w.id,
      });
      await writeText(json);
      setActionNotice("Copied workflow JSON to clipboard.");
    } catch (e) {
      setActionErr(String(e));
    } finally {
      setActionBusy(false);
    }
  }

  async function openInComfyUi(w: WorkflowSummary) {
    const projectDir = scope === "project" ? resolvedProjectDir : null;
    setActionBusy(true);
    setActionErr(null);
    setActionNotice(null);
    try {
      const json = await cmd<string>("get_workflow_json", {
        scope,
        project_dir: projectDir,
        workflow_id: w.id,
      });
      await writeText(json);

      await cmd<void>("open_workflow_in_comfyui", {
        scope,
        project_dir: projectDir,
        workflow_id: w.id,
      });

      setActionNotice(
        <div className="space-y-2 text-sm text-fg">
          <div className="font-medium">Next steps in ComfyUI</div>
          <ol className="list-decimal pl-5 text-sm text-fg">
            <li>Create a new workflow (clear the canvas).</li>
            <li>Click the canvas, then paste (Ctrl+V / Cmd+V).</li>
            <li>
              If paste does not work, use Open Workflow (Ctrl+O / Cmd+O) and
              select the JSON file (use “Reveal workflow JSON” here to find it).
            </li>
          </ol>
          <div className="text-xs text-muted-2">
            The workflow JSON is copied to your clipboard.
          </div>
        </div>,
      );
    } catch (e) {
      setActionErr(String(e));
    } finally {
      setActionBusy(false);
    }
  }

  async function revealWorkflowJson(w: WorkflowSummary) {
    const projectDir = scope === "project" ? resolvedProjectDir : null;
    setActionBusy(true);
    setActionErr(null);
    setActionNotice(null);
    try {
      await cmd<void>("reveal_workflow_json", {
        scope,
        project_dir: projectDir,
        workflow_id: w.id,
      });
      setActionNotice(
        <div className="text-sm text-fg">
          Revealed the workflow JSON file.
        </div>,
      );
    } catch (e) {
      setActionErr(String(e));
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="p-4 w-full max-w-lg mx-auto min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-fg">Workflows</div>
          <div className="mt-2 text-sm text-muted">
            Import ComfyUI workflow JSON files and add metadata for variable injection.
          </div>
          <div className="mt-1 text-xs text-muted-2">
            Scope: {scope === "global" ? "Global" : "Project"}
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => setImportOpen(true)}
          disabled={
            workspaceScope === "project" &&
            !currentProjectDir
          }
          className="px-3 py-2"
        >
          New +
        </Button>
      </div>

      {err && (
        <div className="mt-3 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-fg">
          {err}
        </div>
      )}

      {workspaceScope === "project" && !currentProjectDir && (
        <div className="mt-3 rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning-fg">
          Select or create a project from the sidebar to manage project workflows.
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface px-3 py-3">
          <div className="min-w-[140px] flex-1">
            <label
              htmlFor="workflow-model-filter"
              className="text-xs font-medium text-muted-2"
            >
              Model
            </label>
            <select
              id="workflow-model-filter"
              value={modelFilter}
              onChange={(event) => setModelFilter(event.target.value)}
              className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
            >
              <option value="all">All models</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] flex-1">
            <label
              htmlFor="workflow-approval-filter"
              className="text-xs font-medium text-muted-2"
            >
              Approval
            </label>
            <select
              id="workflow-approval-filter"
              value={approvalFilter}
              onChange={(event) =>
                setApprovalFilter(event.target.value as "all" | "approved" | "custom")
              }
              className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
            >
              <option value="all">All workflows</option>
              <option value="approved">Filmclusive approved</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="min-w-[140px] flex-1">
            <label
              htmlFor="workflow-type-filter"
              className="text-xs font-medium text-muted-2"
            >
              Workflow type
            </label>
            <select
              id="workflow-type-filter"
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as WorkflowTypeFilter)
              }
              className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
            >
              {workflowTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] flex-1">
            <label
              htmlFor="workflow-lora-filter"
              className="text-xs font-medium text-muted-2"
            >
              LoRA
            </label>
            <select
              id="workflow-lora-filter"
              value={loraFilter}
              onChange={(event) =>
                setLoraFilter(event.target.value as LoraFilter)
              }
              className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
            >
              {loraFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface px-3 py-3 text-sm text-muted">
            No workflows yet. Use the New + button to import one.
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface px-3 py-3 text-sm text-muted">
            No workflows match the current filters.
          </div>
        ) : null}
        {approved.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="text-sm font-semibold text-fg">
              Filmclusive approved
            </div>
            <div className="mt-2 space-y-2">{approved.map(renderWorkflowItem)}</div>
          </div>
        )}
        {custom.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="text-sm font-semibold text-fg">Custom</div>
            <div className="mt-2 space-y-2">{custom.map(renderWorkflowItem)}</div>
          </div>
        )}
      </div>

      <Modal
        open={importOpen}
        title="Import workflow"
        size="md"
        onClose={() => {
          if (busy) return;
          setImportOpen(false);
        }}
      >
        <div className="space-y-3">
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
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={jsonPath}
                onChange={setJsonPath}
                placeholder="/path/to/workflow.json"
              />
              <Button
                variant="secondary"
                onClick={chooseWorkflowFile}
                disabled={busy || (workspaceScope === "project" && !currentProjectDir)}
                className="shrink-0"
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
      </Modal>

      <Modal
        open={Boolean(selected)}
        title={selected ? selected.title : "Workflow"}
        onClose={() => {
          if (actionBusy) return;
          setSelected(null);
          setActionErr(null);
          setActionNotice(null);
        }}
      >
        {actionErr && (
          <div className="rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-fg">
            {actionErr}
          </div>
        )}
        {actionNotice && (
          <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg">
            {actionNotice}
          </div>
        )}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            onClick={() => selected && copyWorkflowJson(selected)}
            disabled={!selected || actionBusy}
          >
            Copy workflow JSON
          </Button>
          {comfyUiConfigured ? (
            <Button
              variant="secondary"
              onClick={() => selected && openInComfyUi(selected)}
              disabled={actionBusy || !selected}
            >
              Open in ComfyUI
            </Button>
          ) : (
            <Button variant="secondary" disabled className="cursor-not-allowed">
              Open in ComfyUI (configure in Settings)
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => selected && revealWorkflowJson(selected)}
            disabled={!selected || actionBusy}
          >
            Reveal workflow JSON
          </Button>
        </div>
      </Modal>
    </div>
  );
}
