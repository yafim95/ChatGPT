import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Title3,
} from "@fluentui/react-components";
import {
  ArrowRight20Regular,
  Chat24Regular,
  ClipboardTask24Regular,
  Document24Regular,
  FolderOpen24Regular,
  Warning24Regular,
} from "@fluentui/react-icons";
import { api } from "../../../api/client";
import { useAppLocale } from "../../../app/LocaleContext";
import type { ProjectSection } from "../../../components/AppShell";
import type { Project, ProjectSummary } from "../../../types/api";

interface OverviewSectionProps {
  project: Project;
  summary?: ProjectSummary;
  summaryError?: boolean;
  onNavigate: (section: ProjectSection) => void;
  onEditProject: () => void;
}

function SummaryCard({
  icon,
  value,
  label,
  warning = false,
}: {
  icon: React.ReactElement;
  value: number;
  label: string;
  warning?: boolean;
}): React.JSX.Element {
  const locale = useAppLocale();
  return (
    <Card
      className={`summary-card${warning ? " summary-card--warning" : ""}`}
      appearance="outline"
    >
      <div className="summary-card__icon">{icon}</div>
      <div>
        <Text className="summary-card__value">
          {value.toLocaleString(locale)}
        </Text>
        <Text className="muted-text">{label}</Text>
      </div>
    </Card>
  );
}

export function OverviewSection({
  project,
  summary,
  summaryError = false,
  onNavigate,
  onEditProject,
}: OverviewSectionProps): React.JSX.Element {
  const locale = useAppLocale();
  const documents = useQuery({
    queryKey: ["documents", project.id, "recent"],
    queryFn: () => api.listDocuments(project.id),
    enabled: Boolean(project.settings.workspace_path),
  });
  const recent = documents.data?.items.slice(0, 5) ?? [];

  return (
    <div className="section-stack">
      {!project.settings.workspace_path ? (
        <div className="attention-banner">
          <div className="attention-banner__icon">
            <FolderOpen24Regular />
          </div>
          <div>
            <Text weight="semibold">Choose the project document folder</Text>
            <Text>
              Connect the local folder that contains this project’s
              specifications, drawings, submittals, correspondence, and reports.
            </Text>
          </div>
          <Button
            appearance="primary"
            onClick={() => onNavigate("project-settings")}
          >
            Choose folder
          </Button>
        </div>
      ) : null}

      {summaryError ? (
        <MessageBar intent="error">
          <MessageBarBody>
            The project summary could not be loaded. Document actions remain
            available.
          </MessageBarBody>
        </MessageBar>
      ) : null}

      <div className="section-heading">
        <div>
          <Text className="eyebrow">AT A GLANCE</Text>
          <Title3>Workspace overview</Title3>
        </div>
        {summary?.last_indexed_at ? (
          <Text className="muted-text" size={200}>
            Last indexed{" "}
            {new Date(summary.last_indexed_at).toLocaleString(locale)}
          </Text>
        ) : null}
      </div>
      <div className="summary-grid">
        <SummaryCard
          icon={<Document24Regular />}
          value={summary?.current_document_count ?? 0}
          label="Current documents"
        />
        <SummaryCard
          icon={<Chat24Regular />}
          value={summary?.conversation_count ?? 0}
          label="Conversations"
        />
        <SummaryCard
          icon={<ClipboardTask24Regular />}
          value={summary?.review_count ?? 0}
          label="Draft reviews"
        />
        <SummaryCard
          icon={<Warning24Regular />}
          value={
            (summary?.failed_document_count ?? 0) +
            (summary?.missing_document_count ?? 0)
          }
          label="Items needing attention"
          warning={Boolean(
            (summary?.failed_document_count ?? 0) +
            (summary?.missing_document_count ?? 0),
          )}
        />
      </div>

      <div className="overview-grid">
        <Card className="overview-panel" appearance="outline">
          <div className="panel-heading">
            <div>
              <Text className="eyebrow">QUICK ACTIONS</Text>
              <Title3>Continue your work</Title3>
            </div>
          </div>
          <div className="quick-actions">
            <button onClick={() => onNavigate("documents")}>
              <span className="quick-action__icon">
                <Document24Regular />
              </span>
              <span>
                <Text weight="semibold">Manage documents</Text>
                <Text size={200}>
                  Scan, search, preview, and track revisions
                </Text>
              </span>
              <ArrowRight20Regular />
            </button>
            <button onClick={() => onNavigate("ask")}>
              <span className="quick-action__icon">
                <Chat24Regular />
              </span>
              <span>
                <Text weight="semibold">Ask ProjectMind</Text>
                <Text size={200}>Question indexed evidence with citations</Text>
              </span>
              <ArrowRight20Regular />
            </button>
            <button onClick={() => onNavigate("reviews")}>
              <span className="quick-action__icon">
                <ClipboardTask24Regular />
              </span>
              <span>
                <Text weight="semibold">Start an engineering review</Text>
                <Text size={200}>
                  Material, method statement, ITP, drawing, or report
                </Text>
              </span>
              <ArrowRight20Regular />
            </button>
          </div>
        </Card>

        <Card className="overview-panel" appearance="outline">
          <div className="panel-heading">
            <div>
              <Text className="eyebrow">RECENTLY INDEXED</Text>
              <Title3>Documents</Title3>
            </div>
            <Button appearance="subtle" onClick={() => onNavigate("documents")}>
              View all
            </Button>
          </div>
          {!project.settings.workspace_path ? (
            <div className="panel-empty">
              <Text weight="semibold">Project folder not configured</Text>
              <Text className="muted-text">
                Choose a folder before indexing documents.
              </Text>
              <Button onClick={() => onNavigate("project-settings")}>
                Choose folder
              </Button>
            </div>
          ) : documents.isPending ? (
            <Spinner label="Loading recent documents…" />
          ) : documents.isError ? (
            <MessageBar intent="error">
              <MessageBarBody>
                Recent documents could not be loaded.
              </MessageBarBody>
            </MessageBar>
          ) : recent.length ? (
            <div className="compact-document-list">
              {recent.map((document) => (
                <button
                  key={document.id}
                  onClick={() => onNavigate("documents")}
                >
                  <span
                    className={`file-badge file-badge--${document.extension.replace(".", "")}`}
                  >
                    {document.extension.replace(".", "").toUpperCase()}
                  </span>
                  <span>
                    <Text weight="semibold" truncate>
                      {document.file_name}
                    </Text>
                    <Text size={100} truncate>
                      {document.relative_path}
                    </Text>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel-empty">
              <Text weight="semibold">No indexed documents</Text>
              <Text className="muted-text">
                Open Documents and scan the configured folder.
              </Text>
              <Button onClick={() => onNavigate("documents")}>
                Open documents
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Card className="project-information" appearance="outline">
        <div className="panel-heading">
          <div>
            <Text className="eyebrow">PROJECT IDENTITY</Text>
            <Title3>Key parties</Title3>
          </div>
          <Button appearance="subtle" onClick={onEditProject}>
            Edit
          </Button>
        </div>
        <dl>
          <div>
            <dt>Client</dt>
            <dd>{project.client ?? "Not specified"}</dd>
          </div>
          <div>
            <dt>Consultant</dt>
            <dd>{project.consultant ?? "Not specified"}</dd>
          </div>
          <div>
            <dt>Main contractor</dt>
            <dd>{project.contractor ?? "Not specified"}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{project.description ?? "No description added"}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
