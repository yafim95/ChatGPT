/// <reference types="node" />

import { runInThisContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import rendererBootstrap from "../../src-tauri/src/renderer_bootstrap.js?raw";

interface TauriInternals {
  invoke: ReturnType<typeof vi.fn>;
}

type BootstrapWindow = Window & {
  __TAURI_INTERNALS__?: TauriInternals;
};

const bootstrapWindow = window as BootstrapWindow;

describe("native renderer bootstrap", () => {
  const invoke = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.useFakeTimers();
    invoke.mockClear();
    document.head.innerHTML = "";
    document.body.innerHTML = '<div id="root"></div>';
    delete bootstrapWindow.__PROJECTMIND_BOOT__;
    Object.defineProperty(bootstrapWindow, "__TAURI_INTERNALS__", {
      configurable: true,
      value: { invoke },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete bootstrapWindow.__PROJECTMIND_BOOT__;
    delete bootstrapWindow.__TAURI_INTERNALS__;
  });

  it("shows a styled native recovery surface with working actions", () => {
    runInThisContext(rendererBootstrap);

    bootstrapWindow.__PROJECTMIND_BOOT__?.showRecovery(
      "Automated recovery check",
    );

    expect(
      document.querySelector("[data-projectmind-recovery-styles]"),
    ).toBeInTheDocument();
    expect(
      document.querySelector("[data-projectmind-native-recovery]"),
    ).toHaveTextContent("ProjectMind interface did not start");
    expect(document.querySelectorAll("button")).toHaveLength(3);
    expect(invoke).toHaveBeenCalledWith("report_document_started", {
      location: window.location.href,
    });

    document
      .querySelector<HTMLButtonElement>("[data-projectmind-reset]")
      ?.click();
    expect(invoke).toHaveBeenCalledWith("reset_renderer", {});

    document
      .querySelector<HTMLButtonElement>("[data-projectmind-open-logs]")
      ?.click();
    expect(invoke).toHaveBeenCalledWith("open_diagnostics_folder", {});
  });
});
