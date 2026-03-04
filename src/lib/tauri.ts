import { invoke } from "@tauri-apps/api/tauri";

export async function cmd<T>(name: string, args?: Record<string, unknown>) {
  return invoke<T>(name, args ?? {});
}

