import { invoke, isTauri } from "@tauri-apps/api/core";

export interface BackendBootstrap {
  baseUrl: string;
  sessionToken: string;
  managed: boolean;
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
  return { baseUrl, sessionToken, managed: false };
}

export function getBackendBootstrap(): Promise<BackendBootstrap> {
  bootstrapPromise ??= loadBootstrap();
  return bootstrapPromise;
}

export function resetBackendBootstrapForTests(): void {
  bootstrapPromise = undefined;
}
