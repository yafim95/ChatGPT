import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FrontendErrorBoundary } from "./FrontendErrorBoundary";
import { reportFrontendDiagnostic } from "./frontendDiagnostics";

vi.mock("./frontendDiagnostics", () => ({
  describeFrontendError: (error: unknown): string =>
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  reportFrontendDiagnostic: vi.fn().mockResolvedValue(undefined),
}));

function BrokenInterface(): React.JSX.Element {
  throw new Error("Synthetic renderer failure");
}

describe("FrontendErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a recoverable diagnostic screen and records the render error", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <FrontendErrorBoundary>
        <BrokenInterface />
      </FrontendErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", {
        name: "ProjectMind interface could not load",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Synthetic renderer failure/)).toBeInTheDocument();
    expect(reportFrontendDiagnostic).toHaveBeenCalledWith(
      "react-render-error",
      expect.stringContaining("Synthetic renderer failure"),
    );
  });
});
