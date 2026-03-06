import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { save } from "@tauri-apps/api/dialog";
import { writeText } from "@tauri-apps/api/clipboard";
import { cmd } from "../../lib/tauri";
import { useAppState } from "../../state/AppState";
import type { Project, Scene, Shot } from "../../types";
import { Button } from "../components/Button";

export function ProjectPage() {
  const nav = useNavigate();
  const {
    currentProjectDir,
    setWorkspaceScope,
    project,
    setProject,
    scenes,
    setScenes,
    selectedSceneId,
    setSelectedSceneId,
    shotsBySceneId,
    setShotsBySceneId,
  } = useAppState();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [copyingShotId, setCopyingShotId] = useState<string | null>(null);

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
      .then(([p, sc]) => {
        setProject(p);
        setScenes(sc);
        setSelectedSceneId((prev) => {
          if (prev && sc.some((s) => s.id === prev)) return prev;
          return sc[0]?.id ?? null;
        });
        setShotsBySceneId({});
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setBusy(false));
  }, [
    currentProjectDir,
    setProject,
    setScenes,
    setSelectedSceneId,
    setShotsBySceneId,
  ]);

  useEffect(() => {
    if (!currentProjectDir || !selectedSceneId) return;
    const scene = scenes.find((s) => s.id === selectedSceneId);
    if (!scene) return;
    setErr(null);
    setBusy(true);
    cmd<Shot[]>("list_shots", {
      project_dir: currentProjectDir,
      scene_id: scene.id,
      scene_dir: scene.dirName,
    })
      .then((list) => {
        setShotsBySceneId((prev) => ({ ...prev, [scene.id]: list }));
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setBusy(false));
  }, [currentProjectDir, scenes, selectedSceneId, setShotsBySceneId]);

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

  async function copyShotPrompt(shot: Shot) {
    if (!currentProjectDir) return;
    setErr(null);
    setCopyingShotId(shot.id);
    try {
      const args = {
        project_dir: currentProjectDir,
        scene_id: shot.sceneId,
        shot_id: shot.id,
      };
      const [p, n] = await Promise.all([
        cmd<string>("read_prompt_text", { ...args, kind: "positive" }),
        cmd<string>("read_prompt_text", { ...args, kind: "negative" }),
      ]);
      const format = shot.promptFormat ?? "advanced";
      const text =
        format === "simple"
          ? p
          : `Positive:\n${p}\n\nNegative:\n${n}`;
      await writeText(text);
    } catch (e) {
      setErr(String(e));
    } finally {
      setCopyingShotId(null);
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
            Prompts
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

      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-2">Scene</div>
            <select
              value={selectedSceneId ?? ""}
              onChange={(e) => setSelectedSceneId(e.target.value || null)}
              className="mt-1 w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
              disabled={scenes.length === 0}
            >
              {scenes.length === 0 ? (
                <option value="">No scenes yet</option>
              ) : (
                scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {`Scene ${String(s.number).padStart(2, "0")}: ${s.title || "Untitled"}`}
                  </option>
                ))
              )}
            </select>
            <div className="mt-1 text-xs text-muted-2">
              Scenes live in the left sidebar.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={addShot} disabled={busy || !selectedSceneId}>
              New shot
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-fg">Shots</div>
            <div className="text-xs text-muted-2">{busy ? "Loading…" : ""}</div>
          </div>

          <div className="mt-3 space-y-2">
            {selectedShots.map((shot) => (
              <Link
                key={shot.id}
                to={`/project/shot?projectDir=${encodeURIComponent(
                  currentProjectDir,
                )}&sceneId=${encodeURIComponent(
                  shot.sceneId,
                )}&shotId=${encodeURIComponent(shot.id)}`}
                className="block rounded-md border border-border bg-surface px-3 py-2 hover:bg-surface-hover"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-fg">
                    Shot {String(shot.number).padStart(3, "0")}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      disabled={busy || copyingShotId === shot.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void copyShotPrompt(shot);
                      }}
                    >
                      Copy
                    </Button>
                    <div className="text-xs text-muted-2">{shot.status}</div>
                  </div>
                </div>
                <div className="mt-1 text-sm text-muted">
                  {shot.title || "Untitled"}
                </div>
              </Link>
            ))}

            {selectedShots.length === 0 && (
              <div className="rounded-md border border-border bg-surface px-3 py-3 text-sm text-muted">
                No shots yet for this scene.
              </div>
            )}

            <Button
              variant="secondary"
              onClick={addShot}
              disabled={busy || !selectedSceneId}
              className="w-full"
            >
              Add another shot
            </Button>
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <div className="text-sm font-semibold text-fg">Export</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="accent-accent"
                checked={includeHistory}
                onChange={(e) => setIncludeHistory(e.target.checked)}
              />
              Include history
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="accent-accent"
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
  );
}
