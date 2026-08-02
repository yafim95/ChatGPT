import { afterEach, describe, expect, it, vi } from "vitest";
import { collectRendererEvidence } from "./rendererLifecycle";

function setSurfaceBounds(width: number, height: number): void {
  const surface = document.querySelector("[data-projectmind-surface]");
  if (!surface) {
    throw new Error("Test surface is missing.");
  }
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
    bottom: height,
    height,
    left: 0,
    right: width,
    toJSON: () => ({}),
    top: 0,
    width,
    x: 0,
    y: 0,
  });
}

describe("renderer evidence", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("accepts a painted interface with visible content", () => {
    document.body.innerHTML =
      '<div id="root"><main data-projectmind-surface>Project workspaces</main></div>';
    setSurfaceBounds(1200, 760);

    expect(collectRendererEvidence()).toMatchObject({
      rootHeight: 760,
      rootWidth: 1200,
      visible: true,
      visibleTextLength: 18,
    });
  });

  it("rejects a zero-sized or empty interface", () => {
    document.body.innerHTML =
      '<div id="root"><main data-projectmind-surface></main></div>';
    setSurfaceBounds(0, 0);

    expect(collectRendererEvidence()).toMatchObject({
      rootHeight: 0,
      rootWidth: 0,
      visible: false,
      visibleTextLength: 0,
    });
  });
});
