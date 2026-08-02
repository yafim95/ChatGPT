import { invoke, isTauri } from "@tauri-apps/api/core";

const MAX_DIAGNOSTIC_LENGTH = 4_000;

function truncate(value: string): string {
  return value.length > MAX_DIAGNOSTIC_LENGTH
    ? `${value.slice(0, MAX_DIAGNOSTIC_LENGTH)}…`
    : value;
}

export function describeFrontendError(error: unknown): string {
  if (error instanceof Error) {
    const stack = error.stack?.trim();
    return truncate(
      stack
        ? `${error.name}: ${error.message}\n${stack}`
        : `${error.name}: ${error.message}`,
    );
  }
  if (typeof error === "string") {
    return truncate(error);
  }
  try {
    return truncate(JSON.stringify(error));
  } catch {
    return "Unknown frontend error";
  }
}

export async function reportFrontendDiagnostic(
  event: string,
  detail: string,
): Promise<void> {
  if (!isTauri()) {
    return;
  }
  await invoke("report_frontend_diagnostic", {
    event,
    detail: truncate(detail),
  });
}

export function installGlobalFrontendDiagnostics(): void {
  window.addEventListener("error", (event) => {
    const location = event.filename
      ? ` at ${event.filename}:${String(event.lineno)}:${String(event.colno)}`
      : "";
    void reportFrontendDiagnostic(
      "uncaught-error",
      `${describeFrontendError(event.error ?? event.message)}${location}`,
    ).catch(() => undefined);
  });

  window.addEventListener("unhandledrejection", (event) => {
    void reportFrontendDiagnostic(
      "unhandled-rejection",
      describeFrontendError(event.reason),
    ).catch(() => undefined);
  });
}
