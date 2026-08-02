import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Switch,
  Text,
  Title3,
} from "@fluentui/react-components";
import {
  ArrowClockwise20Regular,
  ArrowLeft20Regular,
  Bot20Regular,
  Chat20Regular,
  CheckmarkCircle20Regular,
  ClipboardTask20Regular,
  Document20Regular,
  Folder20Regular,
  FolderOpen20Regular,
  Open20Regular,
  Search20Regular,
  Star20Regular,
} from "@fluentui/react-icons";
import { api, ApiClientError } from "../../../api/client";
import { nativeErrorMessage, revealLocalPath } from "../../../api/native";
import type {
  Project,
  ProjectDocument,
  ProjectFileEntry,
} from "../../../types/api";

interface FilesSectionProps {
  project: Project;
  onDiscuss: (document: ProjectDocument) => void;
  onReview: (document: ProjectDocument) => void;
  onOpenChat: (conversationId: string) => void;
}

const memoryCategories = [
  "Contract",
  "Employer Requirements",
  "Specifications",
  "IFC Drawings",
  "Authority Requirements",
  "Other",
];

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileType(entry: ProjectFileEntry): string {
  if (entry.kind === "directory") return "Folder";
  return entry.extension?.replace(".", "").toUpperCase() || "FILE";
}

function workflowLabel(state: ProjectFileEntry["workflow_state"]): string {
  if (state === "under_review") return "Under review";
  if (state === "closed") return "Closed";
  return "Not reviewed";
}

export function FilesSection({
  project,
  onDiscuss,
  onReview,
  onOpenChat,
}: FilesSectionProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [path, setPath] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProjectFileEntry>();
  const [nativeError, setNativeError] = useState<string>();

  const listing = useQuery({
    queryKey: ["project-files", project.id, path, search],
    queryFn: () => api.browseFiles(project.id, { path, query: search }),
    enabled: Boolean(project.settings.workspace_path),
  });
  const activeEntry = selected
    ? (listing.data?.items.find(
        (item) => item.relative_path === selected.relative_path,
      ) ?? selected)
    : undefined;
  const preview = useQuery({
    queryKey: [
      "document-preview",
      project.id,
      activeEntry?.indexed_document_id,
    ],
    queryFn: () =>
      api.previewDocument(
        project.id,
        activeEntry?.indexed_document_id as string,
      ),
    enabled: Boolean(activeEntry?.indexed_document_id),
  });
  const relationships = useQuery({
    queryKey: [
      "document-relationships",
      project.id,
      activeEntry?.indexed_document_id,
    ],
    queryFn: () =>
      api.documentRelationships(
        project.id,
        activeEntry?.indexed_document_id as string,
      ),
    enabled: Boolean(activeEntry?.indexed_document_id),
  });
  const scan = useMutation({
    mutationFn: () => api.scanDocuments(project.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["project-files", project.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["documents", project.id] }),
        queryClient.invalidateQueries({
          queryKey: ["project-summary", project.id],
        }),
      ]);
    },
  });
  const workflow = useMutation({
    mutationFn: (payload: Parameters<typeof api.updateDocumentWorkflow>[2]) =>
      api.updateDocumentWorkflow(
        project.id,
        activeEntry?.indexed_document_id as string,
        payload,
      ),
    onSuccess: async (document) => {
      setSelected((current) =>
        current
          ? {
              ...current,
              workflow_state: document.workflow_state,
              review_code: document.review_code,
              is_core_memory: document.is_core_memory,
              memory_category: document.memory_category,
            }
          : current,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["project-files", project.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["documents", project.id] }),
        queryClient.invalidateQueries({
          queryKey: ["document-preview", project.id, document.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-summary", project.id],
        }),
      ]);
    },
  });

  const indexedCount = useMemo(
    () =>
      listing.data?.items.filter((item) => item.indexed_document_id).length ??
      0,
    [listing.data],
  );
  const openInExplorer = async (target: string): Promise<void> => {
    setNativeError(undefined);
    try {
      await revealLocalPath(target);
    } catch (error) {
      setNativeError(
        nativeErrorMessage(error, "Windows could not open this project path."),
      );
    }
  };
  const openEntry = (entry: ProjectFileEntry): void => {
    if (entry.kind === "directory") {
      setPath(entry.relative_path);
      setSearch("");
      setSearchInput("");
      setSelected(undefined);
      return;
    }
    setSelected(entry);
  };

  if (!project.settings.workspace_path) {
    return (
      <div className="feature-empty glass-surface">
        <div className="feature-empty__icon">
          <FolderOpen20Regular />
        </div>
        <Title3>Connect the existing project folder</Title3>
        <Text>
          Open Project controls from the sidebar and choose the folder that
          already contains your contracts, drawings, submittals, correspondence,
          and reports. ProjectMind will browse the folder in place; it does not
          move the files.
        </Text>
      </div>
    );
  }

  return (
    <div className="files-workspace feature-workspace">
      <section className="feature-main glass-surface">
        <div className="feature-toolbar">
          <div>
            <Text className="eyebrow">LIVE PROJECT DIRECTORY</Text>
            <Title3>Project files</Title3>
          </div>
          <div className="feature-toolbar__actions">
            <Button
              icon={<Open20Regular />}
              onClick={() =>
                void openInExplorer(project.settings.workspace_path as string)
              }
            >
              Explorer
            </Button>
            <Button
              appearance="primary"
              icon={<ArrowClockwise20Regular />}
              disabled={scan.isPending}
              onClick={() => scan.mutate()}
            >
              {scan.isPending ? "Indexing…" : "Sync index"}
            </Button>
          </div>
        </div>

        <div className="file-command-row">
          <form
            className="file-search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
              setSelected(undefined);
            }}
          >
            <Input
              contentBefore={<Search20Regular />}
              value={searchInput}
              placeholder="Search names and folder paths"
              aria-label="Search project directory"
              onChange={(_, data) => setSearchInput(data.value)}
            />
            <Button type="submit">Search</Button>
            {search ? (
              <Button
                appearance="subtle"
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                }}
              >
                Clear
              </Button>
            ) : null}
          </form>
          <div className="file-view-summary">
            <span>{listing.data?.total ?? 0} visible</span>
            <span>{indexedCount} indexed here</span>
          </div>
        </div>

        <div className="directory-breadcrumbs" aria-label="Current folder">
          {listing.data?.parent_path !== null && path ? (
            <Button
              appearance="subtle"
              icon={<ArrowLeft20Regular />}
              aria-label="Parent folder"
              onClick={() => {
                setPath(listing.data?.parent_path ?? "");
                setSelected(undefined);
              }}
            />
          ) : null}
          {listing.data?.breadcrumbs.map((crumb, index) => (
            <span key={crumb.relative_path || "root"}>
              {index ? <i>/</i> : null}
              <button
                onClick={() => {
                  setPath(crumb.relative_path);
                  setSearch("");
                  setSearchInput("");
                  setSelected(undefined);
                }}
              >
                {crumb.label}
              </button>
            </span>
          ))}
          {search ? <Text>Search: “{search}”</Text> : null}
        </div>

        {nativeError || scan.isError ? (
          <MessageBar intent="error">
            <MessageBarBody>
              {nativeError ??
                (scan.error instanceof ApiClientError
                  ? scan.error.message
                  : "The project index could not be updated.")}
            </MessageBarBody>
          </MessageBar>
        ) : null}
        {scan.isSuccess ? (
          <MessageBar intent="success">
            <MessageBarBody>
              Index synchronized: {scan.data.added} added, {scan.data.updated}{" "}
              updated, {scan.data.missing} missing, {scan.data.failed} needing
              attention.
            </MessageBarBody>
          </MessageBar>
        ) : null}

        <div className="file-table" role="table" aria-label="Project directory">
          <div className="file-table__head" role="row">
            <span>Name</span>
            <span>Review state</span>
            <span>Linked work</span>
            <span>Modified</span>
            <span>Size</span>
          </div>
          {listing.isPending ? (
            <div className="table-loading">
              <Spinner label="Reading project directory…" />
            </div>
          ) : listing.isError ? (
            <div className="table-empty">
              <Text weight="semibold">
                The project directory could not be read
              </Text>
              <Text>
                {listing.error instanceof ApiClientError
                  ? listing.error.message
                  : "Check that the configured folder is available."}
              </Text>
            </div>
          ) : listing.data.items.length ? (
            listing.data.items.map((entry) => (
              <button
                type="button"
                role="row"
                key={entry.relative_path}
                className={`file-table__row${
                  activeEntry?.relative_path === entry.relative_path
                    ? " is-selected"
                    : ""
                }`}
                onClick={() => openEntry(entry)}
              >
                <span className="file-name-cell">
                  <span
                    className={`file-kind-icon${
                      entry.kind === "directory" ? " is-folder" : ""
                    }`}
                  >
                    {entry.kind === "directory" ? (
                      <Folder20Regular />
                    ) : (
                      <Document20Regular />
                    )}
                  </span>
                  <span>
                    <strong>{entry.name}</strong>
                    <small>
                      {fileType(entry)}
                      {entry.is_core_memory ? " · Project memory" : ""}
                      {entry.kind === "file" && !entry.supported
                        ? " · Preview only"
                        : ""}
                    </small>
                  </span>
                </span>
                <span>
                  {entry.kind === "file" ? (
                    <span
                      className={`workflow-pill workflow-pill--${entry.workflow_state}`}
                    >
                      {entry.review_code ? `Code ${entry.review_code} · ` : ""}
                      {workflowLabel(entry.workflow_state)}
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="linked-work-counts">
                  {entry.related_chat_count ? (
                    <small title="Related chats">
                      <Chat20Regular /> {entry.related_chat_count}
                    </small>
                  ) : null}
                  {entry.review_count ? (
                    <small title="Reviews">
                      <ClipboardTask20Regular /> {entry.review_count}
                    </small>
                  ) : null}
                  {entry.crs_count ? (
                    <small>CRS {entry.crs_count}</small>
                  ) : null}
                  {!entry.related_chat_count &&
                  !entry.review_count &&
                  !entry.crs_count
                    ? "—"
                    : null}
                </span>
                <span>{new Date(entry.modified_at).toLocaleDateString()}</span>
                <span>{formatSize(entry.size_bytes)}</span>
              </button>
            ))
          ) : (
            <div className="table-empty">
              <Text weight="semibold">
                {search ? "No matching project files" : "This folder is empty"}
              </Text>
              <Text>Try another folder or search phrase.</Text>
            </div>
          )}
        </div>
      </section>

      <aside className="feature-inspector glass-surface">
        {!activeEntry ? (
          <div className="inspector-empty">
            <FolderOpen20Regular />
            <Text weight="semibold">Select a file</Text>
            <Text>
              File details, AI context, review status, related chats, and CRS
              records will appear here.
            </Text>
          </div>
        ) : (
          <>
            <div className="inspector-heading">
              <span className="file-kind-icon">
                <Document20Regular />
              </span>
              <div>
                <Text weight="semibold">{activeEntry.name}</Text>
                <Text size={100}>{activeEntry.relative_path}</Text>
              </div>
              <Button
                appearance="subtle"
                icon={<Open20Regular />}
                aria-label="Open in Explorer"
                onClick={() => void openInExplorer(activeEntry.absolute_path)}
              />
            </div>

            {!activeEntry.supported ? (
              <div className="inspector-notice">
                This file is visible in the directory, but its format cannot be
                indexed for AI review yet.
              </div>
            ) : !activeEntry.indexed_document_id ? (
              <div className="inspector-notice">
                This supported file is not indexed yet. Select Sync index to
                extract and search its content.
              </div>
            ) : (
              <>
                <div className="inspector-actions">
                  <Button
                    appearance="primary"
                    icon={<Bot20Regular />}
                    disabled={!preview.data}
                    onClick={() =>
                      preview.data && onDiscuss(preview.data.document)
                    }
                  >
                    Discuss with AI
                  </Button>
                  <Button
                    icon={<ClipboardTask20Regular />}
                    disabled={!preview.data}
                    onClick={() =>
                      preview.data && onReview(preview.data.document)
                    }
                  >
                    Start review
                  </Button>
                </div>

                <div className="inspector-section">
                  <div className="inspector-section__title">
                    <Text weight="semibold">Document workflow</Text>
                    {activeEntry.workflow_state === "closed" ? (
                      <CheckmarkCircle20Regular />
                    ) : null}
                  </div>
                  <label className="native-field">
                    <span>Open / closed state</span>
                    <select
                      value={activeEntry.workflow_state}
                      disabled={workflow.isPending}
                      onChange={(event) =>
                        workflow.mutate({
                          workflow_state: event.target
                            .value as ProjectFileEntry["workflow_state"],
                        })
                      }
                    >
                      <option value="unreviewed">Not reviewed</option>
                      <option value="under_review">Open · under review</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label className="native-field">
                    <span>Consultant decision</span>
                    <select
                      value={activeEntry.review_code ?? ""}
                      disabled={workflow.isPending}
                      onChange={(event) =>
                        workflow.mutate({
                          review_code: event.target.value || null,
                        })
                      }
                    >
                      <option value="">No decision code</option>
                      {project.settings.review_codes.map((code) => (
                        <option key={code.code} value={code.code}>
                          Code {code.code} · {code.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="inspector-section memory-toggle-card">
                  <div>
                    <span className="inspector-section__title">
                      <Star20Regular />
                      <Text weight="semibold">Permanent project memory</Text>
                    </span>
                    <Text size={100}>
                      Reuse this document as controlled context in future chats.
                    </Text>
                  </div>
                  <Switch
                    checked={activeEntry.is_core_memory}
                    disabled={workflow.isPending}
                    onChange={(_, data) =>
                      workflow.mutate({ is_core_memory: data.checked })
                    }
                  />
                  {activeEntry.is_core_memory ? (
                    <label className="native-field">
                      <span>Memory category</span>
                      <select
                        value={activeEntry.memory_category ?? "Other"}
                        onChange={(event) =>
                          workflow.mutate({
                            memory_category: event.target.value,
                          })
                        }
                      >
                        {memoryCategories.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>

                {workflow.isError ? (
                  <MessageBar intent="error">
                    <MessageBarBody>
                      {workflow.error instanceof ApiClientError
                        ? workflow.error.message
                        : "The document workflow could not be updated."}
                    </MessageBarBody>
                  </MessageBar>
                ) : null}

                <div className="inspector-section">
                  <Text weight="semibold">Related work</Text>
                  {relationships.isPending ? (
                    <Spinner size="tiny" label="Loading related work…" />
                  ) : relationships.data ? (
                    <div className="relationship-list">
                      {relationships.data.conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          onClick={() => onOpenChat(conversation.id)}
                        >
                          <Chat20Regular />
                          <span>
                            <strong>{conversation.title}</strong>
                            <small>
                              {conversation.message_count} messages ·{" "}
                              {conversation.relation_type}
                            </small>
                          </span>
                        </button>
                      ))}
                      {relationships.data.reviews.map((review) => (
                        <div key={review.id}>
                          <ClipboardTask20Regular />
                          <span>
                            <strong>{review.title}</strong>
                            <small>
                              {review.workflow_state}
                              {review.decision_code
                                ? ` · Code ${review.decision_code}`
                                : ""}
                            </small>
                          </span>
                        </div>
                      ))}
                      {relationships.data.crs_sheets.map((sheet) => (
                        <div key={sheet.id}>
                          <Document20Regular />
                          <span>
                            <strong>{sheet.title}</strong>
                            <small>{sheet.open_item_count} open comments</small>
                          </span>
                        </div>
                      ))}
                      {!relationships.data.conversations.length &&
                      !relationships.data.reviews.length &&
                      !relationships.data.crs_sheets.length ? (
                        <Text size={100}>
                          No chats, reviews, or CRS records yet.
                        </Text>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="inspector-section document-excerpt">
                  <Text weight="semibold">Indexed preview</Text>
                  {preview.isPending ? (
                    <Spinner size="tiny" />
                  ) : preview.data ? (
                    <Text>
                      {preview.data.text.slice(0, 1800) ||
                        "No extractable text."}
                    </Text>
                  ) : null}
                </div>
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
