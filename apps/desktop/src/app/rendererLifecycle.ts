import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  describeFrontendError,
  reportFrontendDiagnostic,
} from "./frontendDiagnostics";

export interface RendererEvidence {
  location: string;
  readyState: string;
  rootHeight: number;
  rootWidth: number;
  topElement: string;
  visible: boolean;
  visibleTextLength: number;
}

interface ProjectMindNativeBoot {
  markMounted: (evidence: RendererEvidence) => Promise<void>;
  markReady: () => void;
  report: (event: string, detail: unknown) => Promise<void>;
  showRecovery: (reason: string) => void;
}

declare global {
  interface Window {
    __PROJECTMIND_BOOT__?: ProjectMindNativeBoot;
  }
}

function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function elementDescription(element: Element | null): string {
  if (!element) {
    return "none";
  }
  const id = element.id ? `#${element.id}` : "";
  const classes =
    element.classList.length > 0
      ? `.${Array.from(element.classList).slice(0, 3).join(".")}`
      : "";
  return `${element.tagName.toLowerCase()}${id}${classes}`;
}

export function collectRendererEvidence(): RendererEvidence {
  const root = document.getElementById("root");
  const surface =
    document.querySelector("[data-projectmind-surface]") ??
    root?.firstElementChild ??
    root;

  if (!surface) {
    return {
      location: window.location.href,
      readyState: document.readyState,
      rootHeight: 0,
      rootWidth: 0,
      topElement: "none",
      visible: false,
      visibleTextLength: 0,
    };
  }

  const rect = surface.getBoundingClientRect();
  const style = window.getComputedStyle(surface);
  const text = surface.textContent.replace(/\s+/gu, " ").trim();
  const centerX = Math.min(
    Math.max(rect.left + rect.width / 2, 0),
    Math.max(window.innerWidth - 1, 0),
  );
  const centerY = Math.min(
    Math.max(rect.top + rect.height / 2, 0),
    Math.max(window.innerHeight - 1, 0),
  );
  const topElement =
    typeof document.elementFromPoint === "function"
      ? document.elementFromPoint(centerX, centerY)
      : surface;
  const visible =
    rect.width >= 300 &&
    rect.height >= 200 &&
    text.length >= 10 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0";

  return {
    location: window.location.href,
    readyState: document.readyState,
    rootHeight: Math.round(rect.height),
    rootWidth: Math.round(rect.width),
    topElement: elementDescription(topElement),
    visible,
    visibleTextLength: text.length,
  };
}

export async function reportRendererMounted(): Promise<void> {
  await afterPaint();
  const evidence = collectRendererEvidence();

  try {
    if (window.__PROJECTMIND_BOOT__) {
      await window.__PROJECTMIND_BOOT__.markMounted(evidence);
    } else if (isTauri()) {
      await invoke("report_renderer_mounted", { evidence });
    }
  } catch (error) {
    await reportFrontendDiagnostic(
      "renderer-mounted-report-error",
      describeFrontendError(error),
    ).catch(() => undefined);
  }
}

export async function reportVisibleInterface(): Promise<void> {
  await afterPaint();
  const evidence = collectRendererEvidence();

  if (!isTauri()) {
    return;
  }

  try {
    await invoke("report_frontend_ready", { evidence });
    window.__PROJECTMIND_BOOT__?.markReady();
  } catch (error) {
    await reportFrontendDiagnostic(
      "visible-interface-report-error",
      describeFrontendError(error),
    ).catch(() => undefined);
    throw error;
  }
}

export async function resetRenderer(): Promise<void> {
  if (isTauri()) {
    await invoke("reset_renderer");
  } else {
    window.location.reload();
  }
}

export async function openDiagnosticsFolder(): Promise<void> {
  if (isTauri()) {
    await invoke("open_diagnostics_folder");
  }
}
