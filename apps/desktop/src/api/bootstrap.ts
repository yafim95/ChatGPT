import { invoke, isTauri } from "@tauri-apps/api/core";
import { reportVisibleInterface } from "../app/rendererLifecycle";

export interface BackendBootstrap {
  baseUrl: string;
  rendererLaunchId: string;
  sessionToken: string;
  managed: boolean;
}

export interface BackendRuntimeStatus {
  running: boolean;
  managed: boolean;
  lastError?: string;
  logPath: string;
}

let bootstrapPromise: Promise<BackendBootstrap> | undefined;

async function loadBootstrap(): Promise<BackendBootstrap> {
  if (isTauri()) {
    return invoke<BackendBootstrap>("backend_bootstrap");
  }

  const baseUrl = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8765";
  const sessionToken = import.meta.env.VITE_BACKEND_TOKEN;
  if (!sessionToken) {
    throw new Error(
      "VITE_BACKEND_TOKEN is required when the interface runs outside Tauri.",
    );
  }
  return {
    baseUrl,
    rendererLaunchId: "browser-development",
    sessionToken,
    managed: false,
  };
}

export function getBackendBootstrap(): Promise<BackendBootstrap> {
  bootstrapPromise ??= loadBootstrap();
  return bootstrapPromise;
}

export async function restartBackend(): Promise<BackendBootstrap> {
  const bootstrap = isTauri()
    ? await invoke<BackendBootstrap>("restart_backend")
    : await loadBootstrap();
  bootstrapPromise = Promise.resolve(bootstrap);
  return bootstrap;
}

export async function getBackendRuntimeStatus(): Promise<
  BackendRuntimeStatus | undefined
> {
  if (!isTauri()) {
    return undefined;
  }
  return invoke<BackendRuntimeStatus>("backend_runtime_status");
}

export async function reportFrontendReady(): Promise<void> {
  await reportVisibleInterface();
}

export function resetBackendBootstrapForTests(): void {
  bootstrapPromise = undefined;
}
