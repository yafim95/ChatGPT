import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsPage } from "./ProjectsPage";

const mocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  reportFrontendReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../api/client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  api: {
    archiveProject: vi.fn(),
    createProject: vi.fn(),
    listProjects: mocks.listProjects,
    updateProject: vi.fn(),
  },
}));

vi.mock("../api/bootstrap", () => ({
  reportFrontendReady: mocks.reportFrontendReady,
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("ProjectsPage readiness", () => {
  beforeEach(() => {
    mocks.listProjects.mockReset();
    mocks.listProjects.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
    });
    mocks.reportFrontendReady.mockClear();
  });

  it("reports readiness only after settings and the initial project view render", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = createWrapper(queryClient);
    const { rerender, unmount } = render(
      <ProjectsPage settingsReady={false} />,
      {
        wrapper,
      },
    );

    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    expect(mocks.reportFrontendReady).not.toHaveBeenCalled();

    rerender(<ProjectsPage settingsReady />);

    await waitFor(() => {
      expect(mocks.reportFrontendReady).toHaveBeenCalledTimes(1);
    });
    unmount();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
});
