import { useEffect, useState } from "react";
import { cmd } from "../../lib/tauri";
import type { AppSettings } from "../../types";
import { Button } from "../components/Button";
import { useAppState } from "../../state/AppState";
import { open } from "@tauri-apps/api/dialog";
import { platform } from "@tauri-apps/api/os";

export function SettingsPage() {
  const { settings: savedSettings, setSettings: setSavedSettings } = useAppState();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [os, setOs] = useState<string>("unknown");

  useEffect(() => {
    setSettings(savedSettings);
  }, [savedSettings]);

  useEffect(() => {
    platform().then(setOs).catch(() => setOs("unknown"));
  }, []);

  async function persistSettings(next: AppSettings) {
    const saved = await cmd<AppSettings>("set_settings", { settings: next });
    setSettings(saved);
    setSavedSettings(saved);
  }

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

  async function selectComfyUiApplication() {
    if (!settings) return;
    setBusy(true);
    setErr(null);
    try {
      const found = await cmd<string | null>("find_comfyui_application");
      if (found) {
        await persistSettings({
          ...settings,
          comfyui: { ...settings.comfyui, appPath: found },
        });
        return;
      }

      const selected = await open({
        multiple: false,
        title: "Select ComfyUI application",
        directory: os === "darwin",
        filters:
          os === "windows"
            ? [{ name: "Applications", extensions: ["exe"] }]
            : os === "darwin"
              ? [{ name: "Applications", extensions: ["app"] }]
              : undefined,
      });

      if (typeof selected !== "string" || !selected.trim()) return;
      if (os === "darwin" && !selected.toLowerCase().endsWith(".app")) {
        setErr("Select the ComfyUI.app application.");
        return;
      }

      await persistSettings({
        ...settings,
        comfyui: { ...settings.comfyui, appPath: selected },
      });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function findComfyUiApplication() {
    if (!settings) return;
    setBusy(true);
    setErr(null);
    try {
      const selected = await open({
        multiple: false,
        title: "Select ComfyUI application",
        directory: os === "darwin",
        filters:
          os === "windows"
            ? [{ name: "Applications", extensions: ["exe"] }]
            : os === "darwin"
              ? [{ name: "Applications", extensions: ["app"] }]
              : undefined,
      });

      if (typeof selected !== "string" || !selected.trim()) return;
      if (os === "darwin" && !selected.toLowerCase().endsWith(".app")) {
        setErr("Select the ComfyUI.app application.");
        return;
      }

      await persistSettings({
        ...settings,
        comfyui: { ...settings.comfyui, appPath: selected },
      });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openComfyUiApplication() {
    setBusy(true);
    setErr(null);
    try {
      await cmd<void>("open_comfyui_application");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!settings?.comfyui.appPath) {
      cmd<string | null>("find_comfyui_application")
        .then((found) => {
          if (!found) return;
          const updated: AppSettings = {
            ...settings!,
            comfyui: { ...settings!.comfyui, appPath: found },
          };
          return cmd<AppSettings>("set_settings", { settings: updated }).then((saved) => {
            setSettings(saved);
            setSavedSettings(saved);
          });
        })
        .catch(() => {
          // non-blocking
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.comfyui.appPath]);

  const comfyUiLabel = settings?.comfyui.appPath
    ? settings.comfyui.appPath.split(/[/\\]/).pop() ?? "ComfyUI"
    : "Not set";

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
            <div className="mt-2 rounded-md border border-border bg-surface px-3 py-3">
              <div className="text-xs font-medium text-muted-2">Application</div>
              <div className="mt-1 text-sm text-fg">{comfyUiLabel}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={selectComfyUiApplication}
                  disabled={busy}
                >
                  Select application
                </Button>
                <Button
                  variant="secondary"
                  onClick={findComfyUiApplication}
                  disabled={busy}
                >
                  Find application
                </Button>
                <Button
                  onClick={openComfyUiApplication}
                  disabled={busy || !settings.comfyui.appPath}
                >
                  Open ComfyUI
                </Button>
              </div>
              <div className="mt-2 text-xs text-muted-2">
                If ComfyUI is not detected, use Find application to select it from your Applications or Programs folder.
              </div>
            </div>
            <div className="mt-3">
              <Button onClick={save} disabled={busy}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
