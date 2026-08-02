import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import type { HealthResponse, Project } from "../types/api";

const health: HealthResponse = {
  status: "ok",
  version: "0.3.0",
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
    excluded_patterns: [],
    ai_project_instructions: null,
    auto_create_crs: true,
    default_review_due_days: 14,
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
    fireEvent.click(screen.getByRole("button", { name: "Project files" }));
    fireEvent.click(screen.getByRole("button", { name: "AI workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Reviews & CRS" }));
    fireEvent.click(screen.getByRole("button", { name: "Project memory" }));
    fireEvent.click(screen.getByRole("button", { name: "How to use" }));
    fireEvent.click(screen.getByRole("button", { name: "Project controls" }));

    expect(onNavigate).toHaveBeenNthCalledWith(1, "home");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "projects");
    expect(onNavigate).toHaveBeenNthCalledWith(3, "settings");
    expect(onProjectSectionChange).toHaveBeenNthCalledWith(1, "files");
    expect(onProjectSectionChange).toHaveBeenNthCalledWith(2, "ai");
    expect(onProjectSectionChange).toHaveBeenNthCalledWith(3, "reviews");
    expect(onProjectSectionChange).toHaveBeenNthCalledWith(4, "memory");
    expect(onProjectSectionChange).toHaveBeenNthCalledWith(5, "guide");
    expect(onProjectSectionChange).toHaveBeenNthCalledWith(
      6,
      "project-settings",
    );
  });
});
