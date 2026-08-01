import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import type { HealthResponse, Project } from "../types/api";

const health: HealthResponse = {
  status: "ok",
  version: "0.2.0",
  database: "ok",
  environment: "test",
  timestamp: "2026-08-01T00:00:00Z",
};

const project: Project = {
  id: "project-id",
  name: "Navigation Project",
  project_number: "NAV-001",
  client: null,
  consultant: null,
  contractor: null,
  description: null,
  status: "active",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  settings: {
    timezone: "Asia/Dubai",
    locale: "en-AE",
    disciplines: ["Civil"],
    review_codes: [],
    document_hierarchy: [],
    document_precedence: [],
    workspace_path: "C:\\Projects\\Navigation",
    include_subfolders: true,
    auto_scan_enabled: false,
  },
};

describe("AppShell", () => {
  it("keeps application and project navigation available inside a workspace", () => {
    const onNavigate = vi.fn();
    const onProjectSectionChange = vi.fn();
    render(
      <AppShell
        brandName="ProjectMind Engineering AI"
        view="project"
        project={project}
        projectSection="overview"
        health={health}
        onNavigate={onNavigate}
        onProjectSectionChange={onProjectSectionChange}
      >
        <div>Workspace content</div>
      </AppShell>,
    );

    expect(screen.getByText("Navigation Project")).toBeInTheDocument();
    expect(screen.getByText("Workspace content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Documents" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask Project" }));

    expect(onNavigate).toHaveBeenNthCalledWith(1, "home");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "projects");
    expect(onNavigate).toHaveBeenNthCalledWith(3, "settings");
    expect(onProjectSectionChange).toHaveBeenNthCalledWith(1, "documents");
    expect(onProjectSectionChange).toHaveBeenNthCalledWith(2, "ask");
  });
});
