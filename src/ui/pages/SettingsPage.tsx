import { useEffect, useState } from "react";
import { cmd } from "../../lib/tauri";
import type { AppSettings } from "../../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useAppState } from "../../state/AppState";

export function SettingsPage() {
  const { settings: savedSettings, setSettings: setSavedSettings } = useAppState();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSettings(savedSettings);
  }, [savedSettings]);

  async function save() {
    if (!settings) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await cmd<AppSettings>("set_settings", { settings });
      setSettings(updated);
      setSavedSettings(updated);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function launchComfyUI() {
    setBusy(true);
    setErr(null);
    try {
      await cmd<void>("launch_comfyui");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function stopComfyUI() {
    setBusy(true);
    setErr(null);
    try {
      await cmd<void>("stop_comfyui");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 max-w-4xl">
      <div className="text-lg font-semibold text-fg">Settings</div>
      <div className="mt-2 text-sm text-muted">
        Configure ComfyUI launch and app defaults.
      </div>

      {err && (
        <div className="mt-3 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger-fg">
          {err}
        </div>
      )}

      {!settings ? (
        <div className="mt-6 text-sm text-muted">Loading…</div>
      ) : (
        <div className="mt-6 rounded-lg border border-border bg-surface p-4 space-y-6">
          <div>
            <div className="text-sm font-semibold text-fg">Appearance</div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-muted-2">Theme</div>
                <div className="mt-1">
                  <select
                    value={settings.theme}
                    onChange={(e) =>
                      setSettings((s) =>
                        s ? { ...s, theme: e.target.value as AppSettings["theme"] } : s,
                      )
                    }
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-ring"
                  >
                    <option value="system">Device default</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <div className="mt-1 text-xs text-muted-2">
                  Uses your device theme by default.
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-fg">ComfyUI</div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-muted-2">Command</div>
                <div className="mt-1">
                  <Input
                    value={settings.comfyui.command}
                    onChange={(v) =>
                      setSettings((s) =>
                        s
                          ? { ...s, comfyui: { ...s.comfyui, command: v } }
                          : s,
                      )
                    }
                    placeholder="python main.py --listen"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-2">
                  Working directory
                </div>
                <div className="mt-1">
                  <Input
                    value={settings.comfyui.workingDir ?? ""}
                    onChange={(v) =>
                      setSettings((s) =>
                        s
                          ? {
                              ...s,
                              comfyui: {
                                ...s.comfyui,
                                workingDir: v.trim() ? v : null,
                              },
                            }
                          : s,
                      )
                    }
                    placeholder="/path/to/ComfyUI"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-2">URL</div>
                <div className="mt-1">
                  <Input
                    value={settings.comfyui.url}
                    onChange={(v) =>
                      setSettings((s) =>
                        s
                          ? { ...s, comfyui: { ...s.comfyui, url: v } }
                          : s,
                      )
                    }
                    placeholder="http://127.0.0.1:8188"
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={save} disabled={busy}>
                Save
              </Button>
              <Button variant="secondary" onClick={launchComfyUI} disabled={busy}>
                Launch ComfyUI
              </Button>
              <Button variant="secondary" onClick={stopComfyUI} disabled={busy}>
                Stop
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
