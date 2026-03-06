# Filmclusive Prompt + Workflow Library (V1 MVP)

Offline, Git-friendly prompt + ComfyUI workflow library for filmmakers and production teams, organized as:

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
- Tauri invoke command args are `snake_case` (e.g. `project_dir`, `scene_id`, `shot_id`).
