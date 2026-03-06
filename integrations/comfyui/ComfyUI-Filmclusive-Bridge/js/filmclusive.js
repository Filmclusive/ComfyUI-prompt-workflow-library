import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style") Object.assign(node.style, v);
    else if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

async function fetchJson(path, opts = {}) {
  const res = await api.fetchApi(path, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Request failed: ${res.status}`);
  return text ? JSON.parse(text) : null;
}

function getGraph() {
  return app?.graph;
}

function getNodes() {
  const g = getGraph();
  if (!g) return [];
  return g._nodes || g._nodes_by_id ? Object.values(g._nodes_by_id || {}) : [];
}

function findWidgets(node) {
  return Array.isArray(node.widgets) ? node.widgets : [];
}

function setWidget(node, widgetName, value) {
  for (const w of findWidgets(node)) {
    if (w?.name === widgetName) {
      w.value = value;
      return true;
    }
  }
  // Some nodes don't name widgets reliably; fall back to first widget if it looks like prompt text.
  if (widgetName === "text") {
    const ws = findWidgets(node);
    if (ws.length === 1 && typeof ws[0].value === "string") {
      ws[0].value = value;
      return true;
    }
  }
  return false;
}

function getWidget(node, widgetName) {
  for (const w of findWidgets(node)) {
    if (w?.name === widgetName) return w.value;
  }
  return undefined;
}

function pickUnique(label, list) {
  if (list.length === 1) return list[0];
  if (list.length === 0) throw new Error(`Could not find ${label} node in the current graph.`);
  throw new Error(`Found multiple ${label} nodes; add a Filmclusive workflow or simplify the graph.`);
}

function findPromptNodes() {
  const nodes = getNodes();
  const clips = nodes.filter((n) => String(n.type || "").includes("CLIPTextEncode"));
  const positive = clips.filter((n) => String(n.title || "").toLowerCase().includes("positive"));
  const negative = clips.filter((n) => String(n.title || "").toLowerCase().includes("negative"));
  return {
    positive: positive.length ? pickUnique("positive prompt", positive) : pickUnique("positive prompt", clips.slice(0, 1)),
    negative: negative.length ? pickUnique("negative prompt", negative) : pickUnique("negative prompt", clips.slice(1, 2)),
  };
}

function findSamplerNodes() {
  const nodes = getNodes();
  const ks = nodes.filter((n) => String(n.type || "").includes("KSampler"));
  const guider = nodes.filter((n) => String(n.type || "").includes("CFGGuider"));
  return {
    ksampler: ks.length ? ks[0] : null,
    cfgGuider: guider.length ? guider[0] : null,
  };
}

function findCanvasNode() {
  const nodes = getNodes();
  const canvas = nodes.filter((n) => {
    const t = String(n.type || "");
    if (t.includes("Empty") && t.toLowerCase().includes("latent")) return true;
    return findWidgets(n).some((w) => w?.name === "width") && findWidgets(n).some((w) => w?.name === "height");
  });
  return canvas.length ? canvas[0] : null;
}

function dirty() {
  const g = getGraph();
  if (!g) return;
  if (g.setDirtyCanvas) g.setDirtyCanvas(true, true);
  if (app.canvas?.setDirty) app.canvas.setDirty(true, true);
}

function serializeGraph() {
  const g = getGraph();
  if (!g) throw new Error("Graph not available.");
  if (typeof g.serialize === "function") return g.serialize();
  if (typeof g.toJSON === "function") return g.toJSON();
  throw new Error("Cannot serialize graph.");
}

async function loadGraphData(data) {
  if (typeof app.loadGraphData === "function") {
    await app.loadGraphData(data);
    return;
  }
  const g = getGraph();
  if (!g) throw new Error("Graph not available.");
  if (typeof g.configure === "function") {
    g.configure(data);
    dirty();
    return;
  }
  throw new Error("Cannot load workflow into graph.");
}

function applyTermsToWorkflowJson(workflow, labels) {
  const map = labels?.labels || labels || {};
  const nodes = workflow?.nodes || [];
  for (const n of nodes) {
    const inputs = n?.inputs;
    if (!Array.isArray(inputs)) continue;
    for (const input of inputs) {
      const name = input?.name;
      if (!name) continue;
      const label = map[name];
      if (!label) continue;
      if (typeof input.label === "string") input.label = label;
      if (typeof input.localized_name === "string") input.localized_name = label;
      // Some workflows nest widget definitions and also include names.
      if (input.widget && typeof input.widget === "object") {
        if (typeof input.widget.label === "string") input.widget.label = label;
        if (typeof input.widget.localized_name === "string") input.widget.localized_name = label;
      }
    }
  }
  return workflow;
}

function extractShotFromGraph() {
  const { positive, negative } = findPromptNodes();
  const prompts = {
    positive: String(getWidget(positive, "text") ?? ""),
    negative: String(getWidget(negative, "text") ?? ""),
  };

  const params = {};

  const canvas = findCanvasNode();
  if (canvas) {
    const w = getWidget(canvas, "width");
    const h = getWidget(canvas, "height");
    if (typeof w === "number") params.width = w;
    if (typeof h === "number") params.height = h;
  }

  const { ksampler, cfgGuider } = findSamplerNodes();
  if (ksampler) {
    const seed = getWidget(ksampler, "seed");
    const steps = getWidget(ksampler, "steps");
    const cfg = getWidget(ksampler, "cfg");
    const sampler = getWidget(ksampler, "sampler_name");
    if (typeof seed === "number") params.seed = seed;
    if (typeof steps === "number") params.steps = steps;
    if (typeof cfg === "number") params.cfg = cfg;
    if (typeof sampler === "string") params.sampler = sampler;
  }
  if (cfgGuider) {
    const cfg = getWidget(cfgGuider, "cfg");
    if (typeof cfg === "number") params.cfg = cfg;
  }

  return { ...prompts, params };
}

function applyShotToGraph(shot) {
  const { positive, negative, params } = shot;
  const nodes = findPromptNodes();
  if (typeof positive === "string") setWidget(nodes.positive, "text", positive);
  if (typeof negative === "string") setWidget(nodes.negative, "text", negative);

  const canvas = findCanvasNode();
  if (canvas && params) {
    if (typeof params.width === "number") setWidget(canvas, "width", params.width);
    if (typeof params.height === "number") setWidget(canvas, "height", params.height);
  }

  const { ksampler, cfgGuider } = findSamplerNodes();
  if (ksampler && params) {
    if (typeof params.seed === "number") setWidget(ksampler, "seed", params.seed);
    if (typeof params.steps === "number") setWidget(ksampler, "steps", params.steps);
    if (typeof params.cfg === "number") setWidget(ksampler, "cfg", params.cfg);
    if (typeof params.sampler === "string") setWidget(ksampler, "sampler_name", params.sampler);
  }
  if (cfgGuider && params) {
    if (typeof params.cfg === "number") setWidget(cfgGuider, "cfg", params.cfg);
  }

  dirty();
}

function mountPanel() {
  const panel = el("div", {
    style: {
      position: "fixed",
      right: "16px",
      top: "56px",
      width: "420px",
      maxHeight: "70vh",
      overflow: "auto",
      background: "var(--comfy-menu-bg)",
      color: "var(--input-text)",
      border: "1px solid var(--border-color)",
      borderRadius: "10px",
      padding: "12px",
      zIndex: 10000,
      display: "none",
    },
  });

  const status = el("div", { style: { fontSize: "12px", opacity: 0.9, whiteSpace: "pre-wrap" } });
  const log = (msg) => (status.textContent = msg);

  const title = el("div", { style: { fontSize: "14px", fontWeight: "600" } }, ["Filmclusive"]);

  const btnRow = (...buttons) =>
    el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" } }, buttons);

  const mkBtn = (label, onClick) =>
    el(
      "button",
      {
        style: {
          padding: "6px 10px",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
          background: "var(--comfy-input-bg)",
          color: "var(--input-text)",
          cursor: "pointer",
          fontSize: "12px",
        },
        onclick: async () => {
          try {
            await onClick();
          } catch (e) {
            log(String(e?.message || e));
          }
        },
      },
      [label],
    );

  const workflowSelect = el("select", {
    style: {
      width: "100%",
      marginTop: "10px",
      padding: "6px 8px",
      borderRadius: "8px",
      border: "1px solid var(--border-color)",
      background: "var(--comfy-input-bg)",
      color: "var(--input-text)",
      fontSize: "12px",
    },
  });

  let cachedWorkflows = [];
  async function refreshWorkflows() {
    const data = await fetchJson("/filmclusive/workflows");
    cachedWorkflows = data.workflows || [];
    workflowSelect.replaceChildren(
      el("option", { value: "" }, ["Select a workflow"]),
      ...cachedWorkflows.map((w) => el("option", { value: w.id }, [w.title])),
    );
  }

  async function showContext() {
    const ctx = await fetchJson("/filmclusive/context");
    log(`Project: ${ctx.project_dir}\nShot: ${ctx.shot_id}`);
  }

  const applyTermsBtn = mkBtn("Update terms", async () => {
    const labels = await fetchJson("/filmclusive/terms");
    const wf = serializeGraph();
    applyTermsToWorkflowJson(wf, labels);
    await loadGraphData(wf);
    log("Updated term labels in the current workflow.");
  });

  const importBtn = mkBtn("Import from current shot", async () => {
    const shot = await fetchJson("/filmclusive/shot");
    applyShotToGraph(shot);
    log("Imported prompts and params from Filmclusive shot.");
  });

  const exportBtn = mkBtn("Export to current shot", async () => {
    const shot = extractShotFromGraph();
    await fetchJson("/filmclusive/shot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shot),
    });
    log("Exported prompts and params to Filmclusive shot.");
  });

  const saveWorkflowBtn = mkBtn("Save workflow to Filmclusive", async () => {
    const title = window.prompt("Workflow title", "Workflow") || "Workflow";
    const labels = await fetchJson("/filmclusive/terms");
    const wf = serializeGraph();
    applyTermsToWorkflowJson(wf, labels);
    const res = await fetchJson("/filmclusive/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, workflow: wf }),
    });
    await refreshWorkflows();
    log(`Saved workflow: ${res.id}`);
  });

  const openWorkflowBtn = mkBtn("Open selected workflow", async () => {
    const id = workflowSelect.value;
    if (!id) throw new Error("Select a workflow first.");
    const wf = await fetchJson(`/filmclusive/workflows/${id}`);
    await loadGraphData(wf);
    log("Loaded workflow into ComfyUI.");
  });

  const refreshBtn = mkBtn("Refresh workflows", async () => {
    await refreshWorkflows();
    log("Workflow list refreshed.");
  });

  const ctxBtn = mkBtn("Refresh context", async () => {
    await showContext();
  });

  panel.append(
    title,
    btnRow(ctxBtn, importBtn, exportBtn),
    btnRow(applyTermsBtn, saveWorkflowBtn),
    workflowSelect,
    btnRow(refreshBtn, openWorkflowBtn),
    el("div", { style: { marginTop: "10px" } }, [status]),
  );

  document.body.append(panel);

  // Initialize.
  showContext().catch((e) => log(String(e?.message || e)));
  refreshWorkflows().catch(() => {});

  return {
    toggle: () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    },
  };
}

let panelApi = null;

app.registerExtension({
  name: "filmclusive.bridge",
  async setup() {
    panelApi = mountPanel();
    try {
      const mod = await import("../../scripts/ui/menu/index.js");
      if (typeof mod.addMenuCommand === "function") {
        mod.addMenuCommand({
          id: "filmclusive.toggle_panel",
          label: "Filmclusive",
          location: "Topbar",
          tooltip: "Open Filmclusive panel",
          function: () => panelApi?.toggle(),
        });
        return;
      }
    } catch {
      // Non-blocking fallback for older frontends.
    }

    // Fallback: add a small top-right button.
    const btn = el(
      "button",
      {
        style: {
          position: "fixed",
          right: "16px",
          top: "12px",
          zIndex: 10001,
          padding: "6px 10px",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
          background: "var(--comfy-input-bg)",
          color: "var(--input-text)",
          cursor: "pointer",
          fontSize: "12px",
        },
        onclick: () => panelApi?.toggle(),
      },
      ["Filmclusive"],
    );
    document.body.append(btn);
  },
});
