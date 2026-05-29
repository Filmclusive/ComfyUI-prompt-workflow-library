
# Filmclusive Prompt + Workflow Library (V1 MVP)

Offline, Git-friendly prompt + ComfyUI workflow library for filmmakers and production teams, organized as:


<img width="1220" height="824" alt="Screenshot 2026-05-29 at 9 52 52 AM" src="https://github.com/user-attachments/assets/802ba768-b93b-40c1-aae3-83dbcdc4b09a" />

<img width="1220" height="1061" alt="Screenshot 2026-05-29 at 9 54 13 AM" src="https://github.com/user-attachments/assets/efc09739-0a7f-41e4-affb-809d53df3e05" />


<img width="1236" height="1062" alt="Screenshot 2026-05-29 at 9 54 54 AM" src="https://github.com/user-attachments/assets/ba23f8a6-76d2-4360-a558-41caccf349dc" />

<img width="1229" height="1061" alt="Screenshot 2026-05-29 at 9 55 13 AM" src="https://github.com/user-attachments/assets/4ce27ceb-b941-4e30-a12e-9ec7ca619bcd" />



**Project → Scene → Shot**

Each shot stores:
- Positive + negative prompts (`positive.txt`, `negative.txt`)
- Core generation params (width/height/seed/steps/cfg/sampler/model name)
- Attachments (images/videos copied into the project folder)
- Linear history snapshots with diff + restore
- Optional workflow selection + ComfyUI workflow template injection

## Project storage layout

A project is a normal folder on disk:

```
MyProject/
  project.json
  scenes/
    scene_01_<id>/
      scene.json
      prompt-library/
      shots/
        shot_001_<id>/
          shot.json
          positive.txt
          negative.txt
          attachments/
          history/
  prompt-library/
  workflows/
    workflow_<id>/
      title.txt
      workflow.json
      workflow.meta.json
    variants/
      <shotId>/
        <timestamp>.json
  exports/
```

Global (app-wide) prompts and workflows are stored in your OS app data folder under:
- `library/global-prompts/`
- `workflows/global/`

## Default (approved) workflows

To ship “Filmclusive approved” workflows with the app, add them to:
- `src-tauri/default_workflows/` (edit `manifest.json`, drop in workflow `.json` files)

On app startup, any defaults missing from your global workflows folder are installed into `workflows/global/`.

## Dev setup

Prereqs:
- Node.js + npm
- Rust toolchain
- Tauri CLI (`cargo install tauri-cli`)

Install dependencies:
- `npm install`

Run the desktop app:
- `npm run tauri dev`

## Build installers (DMG / EXE)

This app uses the built-in Tauri bundler to generate platform installers.

macOS (DMG):
- `npm run desktop:build:mac`
- Output: `src-tauri/target/release/bundle/dmg/*.dmg`

Windows (EXE via NSIS):
- `npm run desktop:build:win`
- Output: `src-tauri/target/release/bundle/nsis/*.exe`

## Current UI (MVP)

- Home: create/open project (folder path)
- Project: scenes + shots + export bundle
- Shot: edit prompts, metadata/params, attachments, revision history (diff/restore), workflow template apply
- Prompts: global prompt library (project/scene/shot scopes supported via parent folder path)
- Workflows: import/list workflows (global + project)
- Settings: ComfyUI command + working directory, launch/stop ComfyUI

## Notes

- Export creates a clean `.zip` bundle (optionally includes history and attachments).
- ComfyUI integration is intentionally “external”: configure a launch command and working directory, then open the web UI URL.

## ComfyUI Filmclusive Bridge (optional)

This repo includes a ComfyUI custom-nodes plugin that can sync prompts/params with the current shot and save/open workflows in the project `workflows/` folder:

- `integrations/comfyui/ComfyUI-Filmclusive-Bridge`

- Tauri invoke command args are `snake_case` (e.g. `project_dir`, `scene_id`, `shot_id`).
