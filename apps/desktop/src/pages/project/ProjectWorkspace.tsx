import { Badge, Button, Text, Title2 } from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  Folder20Regular,
  Settings20Regular,
} from "@fluentui/react-icons";
import type { Project, ProjectSummary } from "../../types/api";
import type { ProjectSection } from "../../components/AppShell";
import { AskSection } from "./sections/AskSection";
import { DocumentsSection } from "./sections/DocumentsSection";
import { OverviewSection } from "./sections/OverviewSection";
import { ProjectSettingsSection } from "./sections/ProjectSettingsSection";
import { ReviewsSection } from "./sections/ReviewsSection";

interface ProjectWorkspaceProps {
  project: Project;
  summary?: ProjectSummary;
  summaryError?: boolean;
  section: ProjectSection;
  onBack: () => void;
  onSectionChange: (section: ProjectSection) => void;
  onEditProject: (project: Project) => void;
  onOpenGlobalSettings: () => void;
}

const sectionLabels: Record<ProjectSection, string> = {
  overview: "Overview",
  documents: "Documents",
  ask: "Ask Project",
  reviews: "Engineering Reviews",
  "project-settings": "Project Settings",
};

export function ProjectWorkspace({
  project,
  summary,
  summaryError,
  section,
  onBack,
  onSectionChange,
  onEditProject,
  onOpenGlobalSettings,
}: ProjectWorkspaceProps): React.JSX.Element {
  return (
    <section className="workspace-page">
      <header className="workspace-header">
        <div className="workspace-header__topline">
          <Button
            appearance="subtle"
            icon={<ArrowLeft20Regular />}
            onClick={onBack}
          >
            All projects
          </Button>
          <span className="breadcrumb-separator">/</span>
          <Text className="muted-text">{sectionLabels[section]}</Text>
        </div>
        <div className="workspace-header__main">
          <div className="workspace-title-block">
            <div className="workspace-avatar">
              {project.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="workspace-title-row">
                <Title2>{project.name}</Title2>
                <Badge appearance="tint" color="success">
                  Active
                </Badge>
              </div>
              <div className="workspace-meta">
                <Text>{project.project_number}</Text>
                <span>•</span>
                <Folder20Regular />
                <Text
                  truncate
                  title={project.settings.workspace_path ?? undefined}
                >
                  {project.settings.workspace_path ?? "Folder not configured"}
                </Text>
              </div>
            </div>
          </div>
          <Button
            icon={<Settings20Regular />}
            onClick={() => onEditProject(project)}
          >
            Edit project
          </Button>
        </div>
      </header>

      <div className="workspace-content">
        {section === "overview" ? (
          <OverviewSection
            project={project}
            summary={summary}
            summaryError={summaryError}
            onNavigate={onSectionChange}
            onEditProject={() => onEditProject(project)}
          />
        ) : section === "documents" ? (
          <DocumentsSection project={project} />
        ) : section === "ask" ? (
          <AskSection project={project} onOpenSettings={onOpenGlobalSettings} />
        ) : section === "reviews" ? (
          <ReviewsSection
            project={project}
            onOpenSettings={onOpenGlobalSettings}
          />
        ) : (
          <ProjectSettingsSection
            key={project.updated_at}
            project={project}
            onEditProject={() => onEditProject(project)}
          />
        )}
      </div>
    </section>
  );
}
