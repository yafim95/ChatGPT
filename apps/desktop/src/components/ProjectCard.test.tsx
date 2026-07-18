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
  },
};

describe("ProjectCard", () => {
  it("shows controlled project identity and actions", async () => {
    const onEdit = vi.fn();
    const onArchive = vi.fn();
    const { unmount } = render(
      <ProjectCard project={project} onEdit={onEdit} onArchive={onArchive} />,
    );

    expect(screen.getByText("Synthetic Logistics Project")).toBeInTheDocument();
    expect(screen.getByText("SLP-001")).toBeInTheDocument();
    expect(screen.getByText("Not specified")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Archive Synthetic Logistics Project",
      }),
    );
    expect(onEdit).toHaveBeenCalledWith(project);
    expect(onArchive).toHaveBeenCalledWith(project);
    unmount();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
});
