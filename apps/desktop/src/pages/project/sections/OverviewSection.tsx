import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
} from "@fluentui/react-components";
import {
  ArrowRight20Regular,
  Bot20Regular,
  Chat20Regular,
  ClipboardTask20Regular,
  Document20Regular,
  FolderOpen20Regular,
  Settings20Regular,
  Sparkle20Regular,
  Warning20Regular,
} from "@fluentui/react-icons";
import { api } from "../../../api/client";
import type { Project, ProjectSummary } from "../../../types/api";
import type { ProjectSection } from "../../../components/AppShell";

interface OverviewSectionProps {
  project: Project;
  summary?: ProjectSummary;
  summaryError?: boolean;
  onNavigate: (section: ProjectSection) => void;
  onOpenConversation: (conversationId: string) => void;
  onEditProject: () => void;
}

export function OverviewSection({
  project,
  summary,
  summaryError,
  onNavigate,
  onOpenConversation,
  onEditProject,
}: OverviewSectionProps): React.JSX.Element {
  const documents = useQuery({
    queryKey: ["documents", project.id, "overview"],
    queryFn: () => api.listDocuments(project.id),
    enabled: Boolean(project.settings.workspace_path),
  });
  const reviews = useQuery({
    queryKey: ["reviews", project.id, "overview"],
    queryFn: () => api.listReviews(project.id),
  });
  const conversations = useQuery({
    queryKey: ["conversations", project.id, "overview"],
    queryFn: () => api.listConversations(project.id),
  });
  const openReviews = (reviews.data ?? []).filter(
    (review) => review.workflow_state === "open",
  );
  const recentDocuments = documents.data?.items.slice(0, 5) ?? [];
  const attentionCount =
    (summary?.failed_document_count ?? 0) +
    (summary?.missing_document_count ?? 0);

  return (
    <div className="command-center section-stack">
      {!project.settings.workspace_path ? (
        <section className="attention-banner attention-banner-v3 glass-surface">
          <div className="attention-banner__icon">
            <FolderOpen20Regular />
          </div>
          <div>
            <Text className="eyebrow">SETUP REQUIRED</Text>
            <Text weight="semibold">
              Connect the existing project directory
            </Text>
            <Text>
              Choose the folder that already contains the project documents,
              then synchronize the local index. Files remain in their current
              locations.
            </Text>
          </div>
          <Button
            appearance="primary"
            onClick={() => onNavigate("project-settings")}
          >
            Open project controls
          </Button>
        </section>
      ) : null}

      {summaryError ? (
        <MessageBar intent="error">
          <MessageBarBody>
            The live project summary could not be loaded. Workspace actions
            remain available.
          </MessageBarBody>
        </MessageBar>
      ) : null}

      <section className="command-intro">
        <div>
          <Text className="eyebrow">PROJECT COMMAND CENTER</Text>
          <h2>Good to see the project under control.</h2>
          <Text>
            Browse the source directory, continue evidence-linked chats, manage
            review decisions, and close CRS comments from one workspace.
          </Text>
        </div>
        <div className="command-intro__status glass-surface">
          <span className={attentionCount ? "is-warning" : "is-ready"} />
          <div>
            <Text weight="semibold">
              {attentionCount
                ? `${String(attentionCount)} indexing items need attention`
                : "Document index healthy"}
            </Text>
            <Text size={100}>
              {summary?.last_indexed_at
                ? `Last synchronized ${new Date(summary.last_indexed_at).toLocaleString()}`
                : "Run the first directory synchronization"}
            </Text>
          </div>
        </div>
      </section>

      <div className="command-stat-grid">
        <button
          className="command-stat glass-surface"
          onClick={() => onNavigate("files")}
        >
          <span className="command-stat__icon command-stat__icon--blue">
            <Document20Regular />
          </span>
          <span>
            <strong>{summary?.current_document_count ?? 0}</strong>
            <small>indexed documents</small>
          </span>
          <ArrowRight20Regular />
        </button>
        <button
          className="command-stat glass-surface"
          onClick={() => onNavigate("reviews")}
        >
          <span className="command-stat__icon command-stat__icon--amber">
            <ClipboardTask20Regular />
          </span>
          <span>
            <strong>{summary?.open_review_count ?? 0}</strong>
            <small>open reviews</small>
          </span>
          <ArrowRight20Regular />
        </button>
        <button
          className="command-stat glass-surface"
          onClick={() => onNavigate("reviews")}
        >
          <span className="command-stat__icon command-stat__icon--rose">
            <Chat20Regular />
          </span>
          <span>
            <strong>{summary?.open_crs_item_count ?? 0}</strong>
            <small>open CRS comments</small>
          </span>
          <ArrowRight20Regular />
        </button>
        <button
          className="command-stat glass-surface"
          onClick={() => onNavigate("memory")}
        >
          <span className="command-stat__icon command-stat__icon--violet">
            <Sparkle20Regular />
          </span>
          <span>
            <strong>{summary?.core_memory_count ?? 0}</strong>
            <small>project-memory files</small>
          </span>
          <ArrowRight20Regular />
        </button>
      </div>

      <div className="command-layout">
        <section className="command-panel command-panel--reviews glass-surface">
          <div className="panel-heading">
            <div>
              <Text className="eyebrow">REVIEW PIPELINE</Text>
              <h3>Open document reviews</h3>
            </div>
            <Button appearance="subtle" onClick={() => onNavigate("reviews")}>
              View register
            </Button>
          </div>
          {reviews.isPending ? (
            <Spinner label="Loading review register…" />
          ) : openReviews.length ? (
            <div className="overview-review-list">
              {openReviews.slice(0, 6).map((review) => (
                <button key={review.id} onClick={() => onNavigate("reviews")}>
                  <span className="review-state-dot review-state-dot--open" />
                  <span>
                    <strong>{review.title}</strong>
                    <small>
                      {review.document_file_name ??
                        review.review_type.replaceAll("_", " ")}
                    </small>
                  </span>
                  <span>
                    {review.decision_code ? (
                      <Badge appearance="filled">
                        Code {review.decision_code}
                      </Badge>
                    ) : (
                      <Badge appearance="outline">Pending</Badge>
                    )}
                    <small>
                      {review.due_at
                        ? new Date(review.due_at).toLocaleDateString()
                        : "No due date"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel-empty panel-empty--large">
              <ClipboardTask20Regular />
              <Text weight="semibold">No open reviews</Text>
              <Text>
                Select a submitted document and start a controlled review.
              </Text>
              <Button
                appearance="primary"
                onClick={() => onNavigate("reviews")}
              >
                Create review
              </Button>
            </div>
          )}
        </section>

        <section className="command-panel glass-surface">
          <div className="panel-heading">
            <div>
              <Text className="eyebrow">RECENT AI WORK</Text>
              <h3>Project conversations</h3>
            </div>
            <Button appearance="subtle" onClick={() => onNavigate("ai")}>
              Open AI workspace
            </Button>
          </div>
          {conversations.isPending ? (
            <Spinner size="tiny" />
          ) : conversations.data?.length ? (
            <div className="overview-chat-list">
              {conversations.data.slice(0, 5).map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => onOpenConversation(conversation.id)}
                >
                  <span>
                    <Bot20Regular />
                  </span>
                  <span>
                    <strong>{conversation.title}</strong>
                    <small>
                      {conversation.documents.length
                        ? conversation.documents
                            .map((item) => item.file_name)
                            .slice(0, 2)
                            .join(", ")
                        : "General project context"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel-empty panel-empty--large">
              <Bot20Regular />
              <Text weight="semibold">No project chats yet</Text>
              <Text>Select files and start an evidence-linked discussion.</Text>
              <Button onClick={() => onNavigate("ai")}>Start chat</Button>
            </div>
          )}
        </section>
      </div>

      <div className="command-layout command-layout--secondary">
        <section className="command-panel glass-surface">
          <div className="panel-heading">
            <div>
              <Text className="eyebrow">RECENTLY INDEXED</Text>
              <h3>Project documents</h3>
            </div>
            <Button appearance="subtle" onClick={() => onNavigate("files")}>
              Browse all
            </Button>
          </div>
          <div className="overview-document-list">
            {recentDocuments.map((document) => (
              <button key={document.id} onClick={() => onNavigate("files")}>
                <span className="file-kind-icon">
                  <Document20Regular />
                </span>
                <span>
                  <strong>{document.file_name}</strong>
                  <small>{document.relative_path}</small>
                </span>
                {document.is_core_memory ? (
                  <Badge appearance="tint" color="brand">
                    Memory
                  </Badge>
                ) : document.extraction_status !== "ready" ? (
                  <Warning20Regular />
                ) : null}
              </button>
            ))}
            {!documents.isPending && !recentDocuments.length ? (
              <div className="panel-empty">
                <Text>No indexed documents yet.</Text>
              </div>
            ) : null}
          </div>
        </section>

        <section className="command-panel project-parties glass-surface">
          <div className="panel-heading">
            <div>
              <Text className="eyebrow">PROJECT IDENTITY</Text>
              <h3>Key parties</h3>
            </div>
            <Button
              appearance="subtle"
              icon={<Settings20Regular />}
              onClick={onEditProject}
            >
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
              <dt>Project description</dt>
              <dd>{project.description ?? "No description added"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
