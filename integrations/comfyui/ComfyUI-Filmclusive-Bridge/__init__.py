"""
Filmclusive <-> ComfyUI bridge

This package is meant to be installed into:
  ComfyUI/custom_nodes/ComfyUI-Filmclusive-Bridge/
"""

from . import routes as _routes  # noqa: F401  (registers PromptServer routes)

WEB_DIRECTORY = "./js"

# This plugin is primarily a web + API extension. No runtime nodes are required for v1.
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

