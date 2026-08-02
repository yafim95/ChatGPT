import { useState } from "react";
import { Badge, Button, Text, Title2 } from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  Folder20Regular,
  Settings20Regular,
} from "@fluentui/react-icons";
import type { Project, ProjectDocument, ProjectSummary } from "../../types/api";
import type { ProjectSection } from "../../components/AppShell";
import { AIWorkspaceSection } from "./sections/AIWorkspaceSection";
import { FilesSection } from "./sections/FilesSection";
import { GuideSection } from "./sections/GuideSection";
import { MemorySection } from "./sections/MemorySection";
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
  autoIncludeCoreMemory: boolean;
}

const sectionLabels: Record<ProjectSection, string> = {
  overview: "Command center",
  files: "Project files",
  ai: "AI workspace",
  reviews: "Reviews & CRS",
  memory: "Project memory",
  guide: "Workflow guide",
  "project-settings": "Project controls",
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
  autoIncludeCoreMemory,
}: ProjectWorkspaceProps): React.JSX.Element {
  const [contextDocuments, setContextDocuments] = useState<ProjectDocument[]>(
    [],
  );
  const [reviewDocument, setReviewDocument] = useState<ProjectDocument>();
  const [conversationId, setConversationId] = useState<string>();

  const addContextDocument = (document: ProjectDocument): void => {
    setContextDocuments((current) =>
      current.some((item) => item.id === document.id)
        ? current
        : [...current, document].slice(-20),
    );
  };
  const discussDocument = (document: ProjectDocument): void => {
    addContextDocument(document);
    onSectionChange("ai");
  };
  const reviewSelectedDocument = (document: ProjectDocument): void => {
    setReviewDocument(document);
    onSectionChange("reviews");
  };

  return (
    <section className="workspace-page workspace-page-v3">
      <header className="project-hero glass-surface">
        <div className="project-hero__navigation">
          <Button
            appearance="subtle"
            icon={<ArrowLeft20Regular />}
            onClick={onBack}
          >
            Projects
          </Button>
          <span>/</span>
          <Text>{sectionLabels[section]}</Text>
        </div>
        <div className="project-hero__main">
          <div className="project-hero__identity">
            <div className="workspace-avatar workspace-avatar-v3">
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
          <div className="project-hero__metrics">
            <span>
              <strong>{summary?.current_document_count ?? 0}</strong>
              <small>documents</small>
            </span>
            <span>
              <strong>{summary?.open_review_count ?? 0}</strong>
              <small>open reviews</small>
            </span>
            <span>
              <strong>{summary?.core_memory_count ?? 0}</strong>
              <small>memory files</small>
            </span>
          </div>
          <Button
            icon={<Settings20Regular />}
            onClick={() => onSectionChange("project-settings")}
          >
            Controls
          </Button>
        </div>
      </header>

      <div className="workspace-content workspace-content-v3">
        {section === "overview" ? (
          <OverviewSection
            project={project}
            summary={summary}
            summaryError={summaryError}
            onNavigate={onSectionChange}
            onOpenConversation={(id) => {
              setConversationId(id);
              onSectionChange("ai");
            }}
            onEditProject={() => onEditProject(project)}
          />
        ) : section === "files" ? (
          <FilesSection
            project={project}
            onDiscuss={discussDocument}
            onReview={reviewSelectedDocument}
            onOpenChat={(id) => {
              setConversationId(id);
              onSectionChange("ai");
            }}
          />
        ) : section === "ai" ? (
          <AIWorkspaceSection
            project={project}
            contextDocuments={contextDocuments}
            onContextDocumentsChange={setContextDocuments}
            onConversationChange={setConversationId}
            onOpenSettings={onOpenGlobalSettings}
            defaultIncludeCoreMemory={autoIncludeCoreMemory}
            initialConversationId={conversationId}
          />
        ) : section === "reviews" ? (
          <ReviewsSection
            project={project}
            initialDocument={reviewDocument}
            onOpenSettings={onOpenGlobalSettings}
            onDiscuss={(document) => {
              addContextDocument(document);
              onSectionChange("ai");
            }}
          />
        ) : section === "memory" ? (
          <MemorySection
            project={project}
            onOpenFiles={() => onSectionChange("files")}
          />
        ) : section === "guide" ? (
          <GuideSection project={project} onNavigate={onSectionChange} />
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
