import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Title1,
  Title3,
} from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowRight20Regular,
  Bot24Regular,
  Briefcase24Regular,
  CheckmarkCircle20Filled,
  Circle20Regular,
  ClipboardTask24Regular,
  Document24Regular,
  ShieldLock24Regular,
} from "@fluentui/react-icons";
import { api } from "../api/client";
import { useAppLocale } from "../app/LocaleContext";
import type { Project } from "../types/api";

interface HomePageProps {
  onCreateProject: () => void;
  onOpenProject: (project: Project) => void;
  onShowProjects: () => void;
  onShowSettings: () => void;
}

function MetricCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactElement;
  value: number;
  label: string;
}): React.JSX.Element {
  const locale = useAppLocale();
  return (
    <Card className="metric-card" appearance="outline">
      <div className="metric-card__icon">{icon}</div>
      <div>
        <Text className="metric-card__value">
          {value.toLocaleString(locale)}
        </Text>
        <Text className="muted-text">{label}</Text>
      </div>
    </Card>
  );
}

export function HomePage({
  onCreateProject,
  onOpenProject,
  onShowProjects,
  onShowSettings,
}: HomePageProps): React.JSX.Element {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard,
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects(),
  });
  const recentProjects = projects.data?.items.slice(0, 4) ?? [];

  return (
    <section className="page page--home">
      <div className="home-hero">
        <div className="home-hero__content">
          <Badge appearance="tint" color="brand" icon={<ShieldLock24Regular />}>
            Local-first engineering workspace
          </Badge>
          <Title1>Project knowledge you can actually work with.</Title1>
          <Text size={400} className="home-hero__description">
            Organize local project documents, search exact evidence, ask Kimi
            with controlled context, and keep engineering reviews traceable to
            their sources.
          </Text>
          <div className="home-hero__actions">
            <Button
              appearance="primary"
              size="large"
              icon={<Add24Regular />}
              onClick={onCreateProject}
            >
              Create project
            </Button>
            <Button
              size="large"
              icon={<Briefcase24Regular />}
              onClick={onShowProjects}
            >
              Browse projects
            </Button>
          </div>
        </div>
        <div className="home-hero__visual" aria-hidden="true">
          <div className="knowledge-orbit knowledge-orbit--one" />
          <div className="knowledge-orbit knowledge-orbit--two" />
          <div className="knowledge-core">
            <Bot24Regular />
          </div>
          <div className="knowledge-chip knowledge-chip--documents">
            <Document24Regular /> Documents
          </div>
          <div className="knowledge-chip knowledge-chip--reviews">
            <ClipboardTask24Regular /> Reviews
          </div>
        </div>
      </div>

      {dashboard.isPending ? (
        <div className="center-state center-state--compact">
          <Spinner label="Loading workspace summary…" />
        </div>
      ) : dashboard.isError ? (
        <MessageBar intent="error">
          <MessageBarBody>
            The workspace summary could not be loaded from the local service.
          </MessageBarBody>
        </MessageBar>
      ) : (
        <div className="metric-grid">
          <MetricCard
            icon={<Briefcase24Regular />}
            value={dashboard.data.active_project_count}
            label="Active projects"
          />
          <MetricCard
            icon={<Document24Regular />}
            value={dashboard.data.indexed_document_count}
            label="Indexed documents"
          />
          <MetricCard
            icon={<Bot24Regular />}
            value={dashboard.data.conversation_count}
            label="Saved conversations"
          />
          <MetricCard
            icon={<ClipboardTask24Regular />}
            value={dashboard.data.review_count}
            label="Draft reviews"
          />
        </div>
      )}

      <div className="home-grid">
        <Card className="home-panel recent-projects" appearance="outline">
          <div className="panel-heading">
            <div>
              <Text className="eyebrow">CONTINUE WORKING</Text>
              <Title3>Recent projects</Title3>
            </div>
            <Button
              appearance="subtle"
              icon={<ArrowRight20Regular />}
              iconPosition="after"
              onClick={onShowProjects}
            >
              View all
            </Button>
          </div>
          {projects.isPending ? (
            <Spinner label="Loading projects…" />
          ) : projects.isError ? (
            <MessageBar intent="error">
              <MessageBarBody>
                Recent projects could not be loaded.
              </MessageBarBody>
            </MessageBar>
          ) : recentProjects.length ? (
            <div className="recent-list">
              {recentProjects.map((project) => (
                <button
                  className="recent-project"
                  key={project.id}
                  onClick={() => onOpenProject(project)}
                >
                  <span className="recent-project__avatar">
                    {project.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="recent-project__copy">
                    <Text weight="semibold">{project.name}</Text>
                    <Text size={200}>{project.project_number}</Text>
                  </span>
                  <span
                    className={`workspace-dot${project.settings.workspace_path ? " workspace-dot--ready" : ""}`}
                  />
                  <ArrowRight20Regular />
                </button>
              ))}
            </div>
          ) : (
            <div className="panel-empty">
              <Text weight="semibold">No projects yet</Text>
              <Text className="muted-text">
                Create a project and choose its local folder.
              </Text>
            </div>
          )}
        </Card>

        <Card className="home-panel setup-panel" appearance="outline">
          <div className="panel-heading">
            <div>
              <Text className="eyebrow">READINESS</Text>
              <Title3>Workspace setup</Title3>
            </div>
          </div>
          <div className="setup-list">
            <div className="setup-item">
              {dashboard.data?.active_project_count ? (
                <CheckmarkCircle20Filled />
              ) : (
                <Circle20Regular />
              )}
              <div>
                <Text weight="semibold">Create a project</Text>
                <Text size={200}>Identity, parties, and local folder</Text>
              </div>
            </div>
            <div className="setup-item">
              {dashboard.data?.indexed_document_count ? (
                <CheckmarkCircle20Filled />
              ) : (
                <Circle20Regular />
              )}
              <div>
                <Text weight="semibold">Index project documents</Text>
                <Text size={200}>PDF, DOCX, XLSX, CSV, Markdown, and text</Text>
              </div>
            </div>
            <div className="setup-item">
              {dashboard.data?.ai_configured ? (
                <CheckmarkCircle20Filled />
              ) : (
                <Circle20Regular />
              )}
              <div>
                <Text weight="semibold">Connect the AI provider</Text>
                <Text size={200}>
                  Protected key and opt-in external requests
                </Text>
              </div>
            </div>
          </div>
          {!dashboard.data?.ai_configured ? (
            <Button onClick={onShowSettings}>Open AI Provider settings</Button>
          ) : null}
        </Card>
      </div>
    </section>
  );
}
