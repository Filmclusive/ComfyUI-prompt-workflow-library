import type { ThemeSetting } from "../types";

export function applyThemeSetting(theme: ThemeSetting | null | undefined) {
  const root = document.documentElement;
  if (!theme || theme === "system") {
    root.removeAttribute("data-theme");
    return;
  }
  root.setAttribute("data-theme", theme);
}

