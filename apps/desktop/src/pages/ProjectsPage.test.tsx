import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsPage } from "./ProjectsPage";

const mocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: {
    archiveProject: vi.fn(),
    listProjects: mocks.listProjects,
    restoreProject: vi.fn(),
  },
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    mocks.listProjects.mockReset();
    mocks.listProjects.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
    });
  });

  it("shows a functional empty state and starts project creation", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const onCreate = vi.fn();
    const wrapper = createWrapper(queryClient);
    const { unmount } = render(
      <ProjectsPage onCreate={onCreate} onEdit={vi.fn()} onOpen={vi.fn()} />,
      { wrapper },
    );

    expect(
      await screen.findByText("Create your first project workspace"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Create first project" }),
    );
    expect(onCreate).toHaveBeenCalledTimes(1);
    unmount();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
});
