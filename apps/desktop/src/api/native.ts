import { invoke, isTauri } from "@tauri-apps/api/core";

export function nativeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}

export async function selectProjectFolder(
  initialPath?: string,
): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>("select_project_folder", {
    initialPath: initialPath || null,
  });
}

export async function revealLocalPath(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("reveal_local_path", { path });
}

export async function openDiagnosticsFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string>("open_diagnostics_folder");
}

export async function resetRenderer(): Promise<void> {
  if (!isTauri()) {
    window.location.reload();
    return;
  }
  await invoke("reset_renderer");
}
