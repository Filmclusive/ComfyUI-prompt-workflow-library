import json
import os
import uuid
from datetime import datetime, timezone
from glob import glob
from pathlib import Path

from aiohttp import web
from server import PromptServer


def _comfyui_root() -> Path:
    # <root>/custom_nodes/ComfyUI-Filmclusive-Bridge/routes.py
    return Path(__file__).resolve().parent.parent.parent


def _bridge_dir() -> Path:
    return _comfyui_root() / "user" / "filmclusive"


def _context_path() -> Path:
    return _bridge_dir() / "context.json"


def _default_terms_path() -> Path:
    return Path(__file__).resolve().parent / "terms.default.json"


def _terms_override_path() -> Path:
    return _bridge_dir() / "terms.json"


def _read_json_file(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_json_file(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(value, f, indent=2, ensure_ascii=True)
        f.write("\n")
        f.flush()
        os.fsync(f.fileno())
    tmp.replace(path)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_context():
    p = _context_path()
    if not p.exists():
        raise web.HTTPBadRequest(
            text="Bridge context not found. Open a shot in Filmclusive to write user/filmclusive/context.json."
        )
    ctx = _read_json_file(p)
    project_dir = ctx.get("projectDir") or ctx.get("project_dir")
    scene_id = ctx.get("sceneId") or ctx.get("scene_id")
    shot_id = ctx.get("shotId") or ctx.get("shot_id")
    if not project_dir or not scene_id or not shot_id:
        raise web.HTTPBadRequest(text="Bridge context is missing project/scene/shot fields.")
    if not Path(project_dir).exists():
        raise web.HTTPBadRequest(text="Bridge context projectDir does not exist.")
    return {
        "project_dir": str(project_dir),
        "scene_id": str(scene_id),
        "shot_id": str(shot_id),
    }


def _find_shot_dir(project_dir: str, shot_id: str) -> Path:
    pattern = os.path.join(project_dir, "scenes", "scene_*", "shots", f"shot_*_{shot_id}")
    matches = [Path(p) for p in glob(pattern)]
    if len(matches) != 1:
        raise web.HTTPBadRequest(
            text=f"Could not uniquely resolve shot folder for shot_id={shot_id}. Found {len(matches)} matches."
        )
    return matches[0]


def _read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def _write_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def _workflow_root(project_dir: str) -> Path:
    return Path(project_dir) / "workflows"


def _list_workflows(project_dir: str):
    root = _workflow_root(project_dir)
    if not root.exists():
        return []
    out = []
    for entry in root.iterdir():
        if not entry.is_dir():
            continue
        name = entry.name
        if not name.startswith("workflow_"):
            continue
        wid = name[len("workflow_") :]
        workflow_json = entry / "workflow.json"
        if not workflow_json.exists():
            continue
        title_path = entry / "title.txt"
        title = _read_text(title_path).strip() or f"Workflow {wid}"
        out.append({"id": wid, "title": title})
    out.sort(key=lambda w: w["title"].lower())
    return out


def _workflow_dir(project_dir: str, workflow_id: str) -> Path:
    d = _workflow_root(project_dir) / f"workflow_{workflow_id}"
    if not d.exists():
        raise web.HTTPNotFound(text="Workflow not found.")
    return d


async def _read_request_json(request: web.Request):
    ctype = request.headers.get("content-type", "")
    if "application/json" in ctype:
        return await request.json()
    # ComfyUI docs and fetchApi often use multipart/form-data.
    form = await request.post()
    if "json" in form:
        return json.loads(form["json"])
    # Fallback: treat form fields as a dict
    return dict(form)


@PromptServer.instance.routes.get("/filmclusive/context")
async def filmclusive_context(_request):
    try:
        ctx = _require_context()
        return web.json_response(ctx)
    except web.HTTPException:
        raise
    except Exception as e:
        raise web.HTTPInternalServerError(text=str(e))


@PromptServer.instance.routes.get("/filmclusive/terms")
async def filmclusive_terms(_request):
    try:
        override = _terms_override_path()
        if override.exists():
            return web.json_response(_read_json_file(override))
        return web.json_response(_read_json_file(_default_terms_path()))
    except Exception as e:
        raise web.HTTPInternalServerError(text=str(e))


@PromptServer.instance.routes.get("/filmclusive/shot")
async def filmclusive_shot(_request):
    try:
        ctx = _require_context()
        shot_dir = _find_shot_dir(ctx["project_dir"], ctx["shot_id"])
        positive = _read_text(shot_dir / "positive.txt")
        negative = _read_text(shot_dir / "negative.txt")
        shot_json_path = shot_dir / "shot.json"
        params = {}
        if shot_json_path.exists():
            shot = _read_json_file(shot_json_path)
            params = shot.get("params") or {}
        return web.json_response({"positive": positive, "negative": negative, "params": params})
    except web.HTTPException:
        raise
    except Exception as e:
        raise web.HTTPInternalServerError(text=str(e))


@PromptServer.instance.routes.post("/filmclusive/shot")
async def filmclusive_write_shot(request):
    try:
        ctx = _require_context()
        shot_dir = _find_shot_dir(ctx["project_dir"], ctx["shot_id"])
        payload = await _read_request_json(request)
        positive = payload.get("positive")
        negative = payload.get("negative")
        params = payload.get("params") or {}

        if positive is not None:
            _write_text(shot_dir / "positive.txt", str(positive))
        if negative is not None:
            _write_text(shot_dir / "negative.txt", str(negative))

        shot_json_path = shot_dir / "shot.json"
        if shot_json_path.exists():
            shot = _read_json_file(shot_json_path)
        else:
            shot = {}

        shot_params = shot.get("params") or {}
        for k in ["width", "height", "seed", "steps", "cfg", "sampler", "modelName"]:
            if k in params and params[k] is not None:
                shot_params[k] = params[k]
        shot["params"] = shot_params
        shot["updatedAt"] = _now_iso()
        _write_json_file(shot_json_path, shot)

        return web.json_response({"ok": True})
    except web.HTTPException:
        raise
    except Exception as e:
        raise web.HTTPInternalServerError(text=str(e))


@PromptServer.instance.routes.get("/filmclusive/workflows")
async def filmclusive_workflows(_request):
    try:
        ctx = _require_context()
        return web.json_response({"workflows": _list_workflows(ctx["project_dir"])})
    except web.HTTPException:
        raise
    except Exception as e:
        raise web.HTTPInternalServerError(text=str(e))


@PromptServer.instance.routes.get(r"/filmclusive/workflows/{workflow_id}")
async def filmclusive_workflow_json(request):
    try:
        ctx = _require_context()
        workflow_id = request.match_info["workflow_id"]
        wdir = _workflow_dir(ctx["project_dir"], workflow_id)
        data = _read_json_file(wdir / "workflow.json")
        return web.json_response(data)
    except web.HTTPException:
        raise
    except Exception as e:
        raise web.HTTPInternalServerError(text=str(e))


@PromptServer.instance.routes.post("/filmclusive/workflows")
async def filmclusive_save_workflow(request):
    try:
        ctx = _require_context()
        payload = await _read_request_json(request)
        title = (payload.get("title") or "").strip() or "Workflow"
        workflow = payload.get("workflow")
        if workflow is None:
            raise web.HTTPBadRequest(text="Missing workflow payload.")

        wid = str(uuid.uuid4())
        wdir = _workflow_root(ctx["project_dir"]) / f"workflow_{wid}"
        wdir.mkdir(parents=True, exist_ok=True)

        _write_json_file(wdir / "workflow.json", workflow)
        _write_text(wdir / "title.txt", title + "\n")

        meta_path = wdir / "workflow.meta.json"
        if not meta_path.exists():
            now = _now_iso()
            meta = {
                "variables": ["positive", "negative", "seed", "steps", "cfg", "width", "height"],
                "notes": "",
                "tags": [],
                "models": [],
                "updatedAt": now,
                "createdAt": now,
            }
            _write_json_file(meta_path, meta)

        return web.json_response({"id": wid, "ok": True})
    except web.HTTPException:
        raise
    except Exception as e:
        raise web.HTTPInternalServerError(text=str(e))

