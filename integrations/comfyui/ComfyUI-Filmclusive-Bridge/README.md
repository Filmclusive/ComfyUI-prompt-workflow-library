# ComfyUI Filmclusive Bridge

Adds a Filmclusive panel to ComfyUI for:
- Import/export prompts + params from the current Filmclusive shot.
- Save/open Filmclusive workflows from the current Filmclusive project.
- Update term labels in workflow JSON using a `terms.json` mapping.

## Install

1. Copy this folder into your ComfyUI custom nodes:
   - `ComfyUI/custom_nodes/ComfyUI-Filmclusive-Bridge/`
2. Restart ComfyUI.

## Filmclusive setup

In Filmclusive:
- Open `Settings` and set `ComfyUI working folder` to your ComfyUI directory.
- Open a shot in Filmclusive to write `ComfyUI/user/filmclusive/context.json`.

In ComfyUI:
- Use the topbar `Filmclusive` menu to open the panel.

## Terms mapping

- Default mapping: `terms.default.json` (shipped with the plugin)
- Override mapping: `ComfyUI/user/filmclusive/terms.json`

Format:

```json
{
  "labels": {
    "cfg": "Prompt strength (CFG)",
    "steps": "Steps"
  }
}
```

