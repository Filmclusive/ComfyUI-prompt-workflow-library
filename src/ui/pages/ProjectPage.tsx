import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { save } from "@tauri-apps/api/dialog";
import { cmd } from "../../lib/tauri";
import { useAppState } from "../../state/AppState";
import type { Project, Scene, Shot } from "../../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";

export function ProjectPage() {
  const nav = useNavigate();
  const {
    currentProjectDir,
    setWorkspaceScope,
    project,
    setProject,
    scenes,
    setScenes,
    shotsBySceneId,
    setShotsBySceneId,
  } = useAppState();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(true);

  const selectedShots = useMemo(
    () => (selectedSceneId ? shotsBySceneId[selectedSceneId] ?? [] : []),
    [selectedSceneId, shotsBySceneId],
  );

  useEffect(() => {
    if (!currentProjectDir) return;
    setErr(null);
    setBusy(true);
    Promise.all([
      cmd<Project>("read_project", { project_dir: currentProjectDir }),
      cmd<Scene[]>("list_scenes", { project_dir: currentProjectDir }),
    ])
      .then(async ([p, sc]) => {
        setProject(p);
        setScenes(sc);
        setSelectedSceneId((prev) => prev ?? sc[0]?.id ?? null);
        const shots: Record<string, Shot[]> = {};
        for (const scene of sc) {
          shots[scene.id] = await cmd<Shot[]>("list_shots", {
            scene_dir: scene.dirName,
            project_dir: currentProjectDir,
            scene_id: scene.id,
          });
        }
        setShotsBySceneId(shots);
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setBusy(false));
  }, [currentProjectDir, setProject, setScenes, setShotsBySceneId]);

  async function addScene() {
    if (!currentProjectDir) return;
    setErr(null);
    setBusy(true);
    try {
      await cmd<Scene>("create_scene", {
        project_dir: currentProjectDir,
        title: newSceneTitle || null,
      });
      const sc = await cmd<Scene[]>("list_scenes", { project_dir: currentProjectDir });
      setScenes(sc);
      setSelectedSceneId((prev) => prev ?? sc[0]?.id ?? null);
      setNewSceneTitle("");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addShot() {
    if (!currentProjectDir || !selectedSceneId) return;
    const scene = scenes.find((s) => s.id === selectedSceneId);
    if (!scene) return;
    setErr(null);
    setBusy(true);
    try {
      const shot = await cmd<Shot>("create_shot", {
        project_dir: currentProjectDir,
        scene_id: scene.id,
      });
      const list = await cmd<Shot[]>("list_shots", {
        project_dir: currentProjectDir,
        scene_id: scene.id,
        scene_dir: scene.dirName,
      });
      setShotsBySceneId({ ...shotsBySceneId, [scene.id]: list });
      nav(`/project/shot?projectDir=${encodeURIComponent(currentProjectDir)}&sceneId=${encodeURIComponent(scene.id)}&shotId=${encodeURIComponent(shot.id)}`);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportBundle() {
    if (!currentProjectDir) return;
    setErr(null);
    setBusy(true);
    try {
      const out = await save({
        title: "Export bundle",
        defaultPath: "filmclusive-export.zip",
        filters: [{ name: "Zip", extensions: ["zip"] }],
      });
      if (!out) return;
      await cmd<string>("export_bundle", {
        project_dir: currentProjectDir,
        options: {
          outputPath: out,
          asZip: true,
          includeHistory,
          includeAttachments,
        },
      });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!currentProjectDir) {
    return (
      <div className="p-4 max-w-4xl">
        <div className="text-lg font-semibold text-fg">Project</div>
        <div className="mt-2 text-sm text-muted">
          No project selected. Choose or create one from the sidebar.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-fg">
            {project?.name ?? "Project"}
          </div>
          <div className="mt-1 text-sm text-muted truncate">
            {currentProjectDir}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={addShot} disabled={busy || !selectedSceneId}>
            New shot
          </Button>
          <Button variant="secondary" onClick={exportBundle} disabled={busy}>
            Export
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setWorkspaceScope("project");
              nav("/prompts");
            }}
          >
            Prompt library
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setWorkspaceScope("project");
              nav("/workflows");
            }}
          >
            Workflows
          </Button>
        </div>
      </div>

      {err && (
        <div className="mt-3 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-fg">
          {err}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4 md:col-span-1">
          <div className="text-sm font-semibold text-fg">Scenes</div>
          <div className="mt-3 space-y-2">
            {scenes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSceneId(s.id)}
                className={
                  "w-full text-left rounded-md border px-3 py-2 " +
                  (s.id === selectedSceneId
                    ? "border-accent bg-surface-hover"
                    : "border-border bg-surface hover:bg-surface-hover")
                }
              >
                <div className="text-sm font-medium text-fg">
                  Scene {String(s.number).padStart(2, "0")}
                </div>
                <div className="mt-1 text-sm text-muted">
                  {s.title || "Untitled"}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <div className="text-xs font-medium text-muted-2">
              New scene title
            </div>
            <Input
              value={newSceneTitle}
              onChange={setNewSceneTitle}
              placeholder="Scene title"
            />
            <Button onClick={addScene} disabled={busy}>
              Add scene
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-fg">Shots</div>
            <div className="text-xs text-muted-2">
              {busy ? "Loading…" : ""}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {selectedShots.map((shot) => (
              <Link
                key={shot.id}
                to={`/project/shot?projectDir=${encodeURIComponent(
                  currentProjectDir,
                )}&sceneId=${encodeURIComponent(
                  shot.sceneId,
                )}&shotId=${encodeURIComponent(shot.id)}`}
                className="rounded-md border border-border bg-surface px-3 py-2 hover:bg-surface-hover"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-fg">
                    Shot {String(shot.number).padStart(3, "0")}
                  </div>
                  <div className="text-xs text-muted-2">{shot.status}</div>
                </div>
                <div className="mt-1 text-sm text-muted">
                  {shot.title || "Untitled"}
                </div>
              </Link>
            ))}
            {selectedShots.length === 0 && (
              <div className="text-sm text-muted">
                No shots yet. Create one.
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="text-sm font-semibold text-fg">Export</div>
            <div className="mt-2 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  className="accent-indigo-600"
                  checked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                />
                Include history
              </label>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  className="accent-indigo-600"
                  checked={includeAttachments}
                  onChange={(e) => setIncludeAttachments(e.target.checked)}
                />
                Include attachments
              </label>
            </div>
            <div className="mt-2 text-xs text-muted-2">
              Export creates a clean zip bundle (can be shared or committed).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
