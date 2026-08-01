import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Switch,
  Text,
  Title3,
  Tooltip,
} from "@fluentui/react-components";
import {
  ArrowSync20Regular,
  Delete20Regular,
  DocumentSearch24Regular,
  Eye20Regular,
  FolderOpen20Regular,
  Open20Regular,
  Search20Regular,
  Warning20Regular,
} from "@fluentui/react-icons";
import { api, ApiClientError } from "../../../api/client";
import {
  nativeErrorMessage,
  revealLocalPath,
  selectProjectFolder,
} from "../../../api/native";
import { useAppLocale } from "../../../app/LocaleContext";
import type {
  Project,
  ProjectDocument,
  SearchResult,
} from "../../../types/api";

interface DocumentsSectionProps {
  project: Project;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${String(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusBadge(document: ProjectDocument): React.JSX.Element {
  if (document.is_missing)
    return (
      <Badge color="warning" icon={<Warning20Regular />}>
        Missing
      </Badge>
    );
  if (document.extraction_status === "failed")
    return <Badge color="danger">Failed</Badge>;
  if (document.extraction_status === "no_text")
    return <Badge color="warning">Needs OCR</Badge>;
  if (document.extraction_status === "removed")
    return <Badge color="subtle">Removed</Badge>;
  if (document.duplicate_of_id)
    return <Badge color="informative">Duplicate</Badge>;
  if (document.version_number > 1)
    return <Badge color="brand">Version {document.version_number}</Badge>;
  return (
    <Badge color="success" appearance="tint">
      Ready
    </Badge>
  );
}

export function DocumentsSection({
  project,
}: DocumentsSectionProps): React.JSX.Element {
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [includeVersions, setIncludeVersions] = useState(false);
  const [previewId, setPreviewId] = useState<string>();
  const [removeTarget, setRemoveTarget] = useState<ProjectDocument>();
  const [nativeError, setNativeError] = useState<string>();

  const documents = useQuery({
    queryKey: ["documents", project.id, includeVersions],
    queryFn: () => api.listDocuments(project.id, { includeVersions }),
    enabled: Boolean(project.settings.workspace_path),
  });
  const contentSearch = useQuery({
    queryKey: ["document-search", project.id, deferredSearch, includeVersions],
    queryFn: () =>
      api.searchDocuments(project.id, deferredSearch, includeVersions),
    enabled:
      deferredSearch.length >= 2 && Boolean(project.settings.workspace_path),
  });
  const preview = useQuery({
    queryKey: ["document-preview", project.id, previewId],
    queryFn: () => api.previewDocument(project.id, previewId as string),
    enabled: Boolean(previewId),
  });

  const refresh = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["documents", project.id] }),
      queryClient.invalidateQueries({
        queryKey: ["document-search", project.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["project-summary", project.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };
  const scan = useMutation({
    mutationFn: () => api.scanDocuments(project.id),
    onSuccess: refresh,
  });
  const chooseFolder = useMutation({
    mutationFn: async () => {
      const selected = await selectProjectFolder(
        project.settings.workspace_path ?? undefined,
      );
      if (!selected) return null;
      await api.updateProjectSettings(project.id, { workspace_path: selected });
      await queryClient.invalidateQueries({
        queryKey: ["project", project.id],
      });
      const result = await api.scanDocuments(project.id);
      return result;
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (documentId: string) =>
      api.removeDocument(project.id, documentId),
    onSuccess: async () => {
      setRemoveTarget(undefined);
      await refresh();
    },
  });

  const error = scan.error ?? chooseFolder.error;
  const scanSummary = scan.data ?? chooseFolder.data;
  const openPath = async (path: string): Promise<void> => {
    setNativeError(undefined);
    try {
      await revealLocalPath(path);
    } catch (actionError) {
      setNativeError(
        nativeErrorMessage(
          actionError,
          "Windows could not open the selected local path.",
        ),
      );
    }
  };

  return (
    <div className="section-stack documents-section">
      <div className="section-heading">
        <div>
          <Text className="eyebrow">LOCAL KNOWLEDGE LIBRARY</Text>
          <Title3>Documents</Title3>
          <Text className="section-description">
            Scan supported files without moving or deleting the originals.
            Changed files become traceable revisions.
          </Text>
        </div>
        <div className="section-actions">
          <Button
            icon={<FolderOpen20Regular />}
            disabled={chooseFolder.isPending || scan.isPending}
            onClick={() => chooseFolder.mutate()}
          >
            {project.settings.workspace_path
              ? "Change folder"
              : "Choose folder"}
          </Button>
          <Button
            appearance="primary"
            icon={<ArrowSync20Regular />}
            disabled={
              !project.settings.workspace_path ||
              scan.isPending ||
              chooseFolder.isPending
            }
            onClick={() => scan.mutate()}
          >
            {scan.isPending ? "Scanning…" : "Scan folder"}
          </Button>
        </div>
      </div>

      {!project.settings.workspace_path ? (
        <div className="empty-state empty-state--large">
          <div className="empty-state__icon">
            <FolderOpen20Regular />
          </div>
          <Title3>No project folder connected</Title3>
          <Text>
            Choose the folder where this project’s documents are stored.
            ProjectMind will index supported files locally and keep the
            originals untouched.
          </Text>
          <Button
            appearance="primary"
            icon={<FolderOpen20Regular />}
            onClick={() => chooseFolder.mutate()}
          >
            Choose project folder
          </Button>
        </div>
      ) : (
        <>
          <div className="folder-strip">
            <FolderOpen20Regular />
            <div>
              <Text weight="semibold">Project folder</Text>
              <Text size={200} title={project.settings.workspace_path}>
                {project.settings.workspace_path}
              </Text>
            </div>
            <Button
              appearance="subtle"
              icon={<Open20Regular />}
              onClick={() =>
                void openPath(project.settings.workspace_path as string)
              }
            >
              Open in Explorer
            </Button>
          </div>

          {error ? (
            <MessageBar intent="error">
              <MessageBarBody>
                {error instanceof ApiClientError
                  ? error.message
                  : "The folder could not be scanned."}
              </MessageBarBody>
            </MessageBar>
          ) : null}
          {nativeError ? (
            <MessageBar intent="error">
              <MessageBarBody>{nativeError}</MessageBarBody>
            </MessageBar>
          ) : null}
          {scanSummary ? (
            <MessageBar intent={scanSummary.failed ? "warning" : "success"}>
              <MessageBarBody>
                Scan complete: {scanSummary.added} added, {scanSummary.updated}{" "}
                revised, {scanSummary.unchanged} unchanged, {scanSummary.failed}{" "}
                failed, and {scanSummary.missing} missing.
              </MessageBarBody>
            </MessageBar>
          ) : null}

          <div className="toolbar surface-card">
            <Input
              className="toolbar-search"
              contentBefore={<Search20Regular />}
              value={search}
              onChange={(_, data) => setSearch(data.value)}
              placeholder="Search inside indexed documents"
            />
            <Switch
              checked={includeVersions}
              onChange={(_, data) => setIncludeVersions(data.checked)}
              label="Include older versions"
            />
            <Text className="muted-text" size={200}>
              {documents.data?.total ?? 0} indexed records
            </Text>
          </div>

          {deferredSearch.length >= 2 ? (
            <div className="search-results-panel">
              <div className="panel-heading">
                <div>
                  <Text className="eyebrow">FULL-TEXT SEARCH</Text>
                  <Title3>Results for “{deferredSearch}”</Title3>
                </div>
                {contentSearch.data ? (
                  <Badge>{contentSearch.data.total} matches</Badge>
                ) : null}
              </div>
              {contentSearch.isPending ? (
                <div className="center-state center-state--compact">
                  <Spinner label="Searching local index…" />
                </div>
              ) : contentSearch.isError ? (
                <MessageBar intent="error">
                  <MessageBarBody>
                    Search could not be completed.
                  </MessageBarBody>
                </MessageBar>
              ) : contentSearch.data.results.length ? (
                <div className="search-result-list">
                  {contentSearch.data.results.map((result: SearchResult) => (
                    <button
                      key={result.document_id}
                      onClick={() => setPreviewId(result.document_id)}
                    >
                      <span className="search-result__icon">
                        <DocumentSearch24Regular />
                      </span>
                      <span>
                        <Text weight="semibold">{result.file_name}</Text>
                        <Text size={200} className="search-result__path">
                          {result.relative_path} · Version{" "}
                          {result.version_number}
                        </Text>
                        <Text className="search-result__excerpt">
                          {result.excerpt}
                        </Text>
                      </span>
                      <Eye20Regular />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="panel-empty">
                  <Text weight="semibold">No matching evidence</Text>
                  <Text className="muted-text">
                    Try exact terminology used in the project documents.
                  </Text>
                </div>
              )}
            </div>
          ) : documents.isPending ? (
            <div className="center-state">
              <Spinner label="Loading document library…" />
            </div>
          ) : documents.isError ? (
            <MessageBar intent="error">
              <MessageBarBody>
                The document library could not be loaded.
              </MessageBarBody>
            </MessageBar>
          ) : documents.data.items.length ? (
            <div className="document-table surface-card">
              <div className="document-row document-row--header">
                <span>Document</span>
                <span>Status</span>
                <span>Size</span>
                <span>Modified</span>
                <span aria-label="Actions" />
              </div>
              {documents.data.items.map((document) => (
                <div className="document-row" key={document.id}>
                  <button
                    className="document-identity"
                    onClick={() => setPreviewId(document.id)}
                  >
                    <span
                      className={`file-badge file-badge--${document.extension.slice(1)}`}
                    >
                      {document.extension.slice(1).toUpperCase()}
                    </span>
                    <span>
                      <Text weight="semibold" truncate>
                        {document.file_name}
                      </Text>
                      <Text size={100} truncate title={document.relative_path}>
                        {document.relative_path}
                      </Text>
                    </span>
                  </button>
                  <span>{statusBadge(document)}</span>
                  <Text size={200}>{formatBytes(document.size_bytes)}</Text>
                  <Text size={200}>
                    {formatDate(document.source_modified_at, locale)}
                  </Text>
                  <span className="document-actions">
                    <Tooltip
                      content="Preview extracted text"
                      relationship="label"
                    >
                      <Button
                        appearance="subtle"
                        icon={<Eye20Regular />}
                        aria-label={`Preview ${document.file_name}`}
                        onClick={() => setPreviewId(document.id)}
                      />
                    </Tooltip>
                    <Tooltip content="Show source file" relationship="label">
                      <Button
                        appearance="subtle"
                        icon={<Open20Regular />}
                        aria-label={`Show ${document.file_name} in Explorer`}
                        onClick={() => void openPath(document.absolute_path)}
                      />
                    </Tooltip>
                    <Tooltip
                      content={
                        document.is_current
                          ? "Remove from index; source file is kept"
                          : "Historical versions are retained for revision history"
                      }
                      relationship="label"
                    >
                      <Button
                        appearance="subtle"
                        icon={<Delete20Regular />}
                        aria-label={`Remove ${document.file_name} from index`}
                        disabled={!document.is_current}
                        onClick={() => {
                          remove.reset();
                          setRemoveTarget(document);
                        }}
                      />
                    </Tooltip>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">
                <DocumentSearch24Regular />
              </div>
              <Title3>No supported documents indexed</Title3>
              <Text>
                Supported formats: PDF, DOCX, XLSX/XLSM, CSV, Markdown, and
                text.
              </Text>
              <Button
                appearance="primary"
                icon={<ArrowSync20Regular />}
                onClick={() => scan.mutate()}
              >
                Scan folder
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={Boolean(previewId)}
        onOpenChange={(_, data) => !data.open && setPreviewId(undefined)}
      >
        <DialogSurface className="preview-dialog">
          <DialogBody>
            <DialogTitle>
              {preview.data?.document.file_name ?? "Document preview"}
            </DialogTitle>
            <DialogContent>
              {preview.isPending ? (
                <Spinner label="Loading extracted text…" />
              ) : preview.isError ? (
                <MessageBar intent="error">
                  <MessageBarBody>
                    The document preview could not be loaded.
                  </MessageBarBody>
                </MessageBar>
              ) : (
                <>
                  <div className="preview-metadata">
                    <Badge>
                      {preview.data.document.extension.slice(1).toUpperCase()}
                    </Badge>
                    <Text size={200}>
                      Version {preview.data.document.version_number}
                    </Text>
                    <Text size={200}>
                      {preview.data.document.word_count.toLocaleString(locale)}{" "}
                      words
                    </Text>
                    {preview.data.document.page_count ? (
                      <Text size={200}>
                        {preview.data.document.page_count} pages
                      </Text>
                    ) : null}
                  </div>
                  {preview.data.document.extraction_error ? (
                    <MessageBar intent="error">
                      <MessageBarBody>
                        {preview.data.document.extraction_error}
                      </MessageBarBody>
                    </MessageBar>
                  ) : (
                    <pre className="document-preview-text">
                      {preview.data.text || "No extractable text was found."}
                    </pre>
                  )}
                  {preview.data.truncated ? (
                    <Text className="muted-text">
                      Preview shortened for performance. Search still uses the
                      indexed text limit.
                    </Text>
                  ) : null}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() =>
                  preview.data &&
                  void openPath(preview.data.document.absolute_path)
                }
                icon={<Open20Regular />}
              >
                Show source file
              </Button>
              <Button
                appearance="primary"
                onClick={() => setPreviewId(undefined)}
              >
                Close
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog
        open={Boolean(removeTarget)}
        onOpenChange={(_, data) => !data.open && setRemoveTarget(undefined)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Remove from ProjectMind index?</DialogTitle>
            <DialogContent>
              <Text>
                {removeTarget?.file_name} will be removed from search and AI
                evidence, including its indexed older versions. The original
                source file will remain untouched. A future folder scan will
                index it again while it remains inside the project folder.
              </Text>
              {remove.isError ? (
                <MessageBar intent="error">
                  <MessageBarBody>
                    The document could not be removed from the local index.
                  </MessageBarBody>
                </MessageBar>
              ) : null}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRemoveTarget(undefined)}>Cancel</Button>
              <Button
                appearance="primary"
                disabled={remove.isPending}
                onClick={() => removeTarget && remove.mutate(removeTarget.id)}
              >
                {remove.isPending ? "Removing…" : "Remove from index"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
