import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectCard } from "./ProjectCard";
import type { Project } from "../types/api";

const project: Project = {
  id: "project-id",
  name: "Synthetic Logistics Project",
  project_number: "SLP-001",
  client: "Example Client",
  consultant: "Example Consultant",
  contractor: null,
  description: null,
  status: "active",
  created_at: "2026-07-18T00:00:00Z",
  updated_at: "2026-07-18T00:00:00Z",
  settings: {
    timezone: "Asia/Dubai",
    locale: "en-AE",
    disciplines: ["Civil"],
    review_codes: [],
    document_hierarchy: [],
    document_precedence: [],
    workspace_path: "C:\\Projects\\Synthetic",
    include_subfolders: true,
    auto_scan_enabled: false,
  },
};

describe("ProjectCard", () => {
  it("shows controlled project identity and actions", async () => {
    const onEdit = vi.fn();
    const onOpen = vi.fn();
    const onArchive = vi.fn();
    const { unmount } = render(
      <ProjectCard
        project={project}
        onOpen={onOpen}
        onEdit={onEdit}
        onArchive={onArchive}
      />,
    );

    expect(screen.getByText("Synthetic Logistics Project")).toBeInTheDocument();
    expect(screen.getByText("SLP-001")).toBeInTheDocument();
    expect(screen.getByText("C:\\Projects\\Synthetic")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Synthetic Logistics Project" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Archive Synthetic Logistics Project",
      }),
    );
    expect(onOpen).toHaveBeenCalledWith(project);
    expect(onEdit).toHaveBeenCalledWith(project);
    expect(onArchive).toHaveBeenCalledWith(project);
    unmount();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });

  it("offers restoration instead of dead-end actions for archived projects", async () => {
    const onRestore = vi.fn();
    const { unmount } = render(
      <ProjectCard
        project={{ ...project, status: "archived" }}
        archived
        onOpen={vi.fn()}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onRestore={onRestore}
      />,
    );

    expect(screen.getByText("Archived")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore project" }));
    expect(onRestore).toHaveBeenCalledWith(
      expect.objectContaining({ id: project.id }),
    );
    expect(
      screen.queryByRole("button", { name: "Open workspace" }),
    ).not.toBeInTheDocument();
    unmount();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
});
