import { getBackendBootstrap } from "./bootstrap";
import type {
  ApiErrorPayload,
  ApplicationSettings,
  Backup,
  ChatMode,
  ChatResponse,
  Conversation,
  DashboardSummary,
  DocumentPage,
  DocumentPreview,
  HealthResponse,
  MaintenanceInfo,
  Project,
  ProjectPage,
  ProjectPayload,
  ProjectSettings,
  ProjectSummary,
  ProviderStatus,
  ProviderTestResult,
  ReviewPayload,
  ReviewRecord,
  ScanSummary,
  SearchResponse,
} from "../types/api";

export class ApiClientError extends Error {
  readonly code: string;
  readonly traceId?: string;
  readonly status: number;

  constructor(
    message: string,
    status: number,
    code = "request_failed",
    traceId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const bootstrap = await getBackendBootstrap();
  const headers = new Headers(init?.headers);
  headers.set("X-ProjectMind-Session", bootstrap.sessionToken);
  headers.set("Accept", "application/json");
  if (init?.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${bootstrap.baseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = undefined;
    }
    throw new ApiClientError(
      payload?.error.message ??
        `Local service request failed (${String(response.status)}).`,
      response.status,
      payload?.error.code,
      payload?.error.trace_id,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function queryString(
  values: Record<string, string | number | boolean | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const result = params.toString();
  return result ? `?${result}` : "";
}

export const api = {
  health: (): Promise<HealthResponse> => request("/api/health"),
  dashboard: (): Promise<DashboardSummary> => request("/api/dashboard"),
  listProjects: (
    status: "active" | "archived" | "all" = "active",
  ): Promise<ProjectPage> =>
    request(`/api/projects?limit=100&offset=0&status=${status}`),
  getProject: (id: string): Promise<Project> => request(`/api/projects/${id}`),
  createProject: (payload: ProjectPayload): Promise<Project> =>
    request("/api/projects", { method: "POST", body: JSON.stringify(payload) }),
  updateProject: (
    id: string,
    payload: Partial<ProjectPayload>,
  ): Promise<Project> =>
    request(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  updateProjectSettings: (
    id: string,
    payload: Partial<ProjectSettings>,
  ): Promise<Project> =>
    request(`/api/projects/${id}/settings`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  archiveProject: (id: string): Promise<void> =>
    request(`/api/projects/${id}`, { method: "DELETE" }),
  restoreProject: (id: string): Promise<Project> =>
    request(`/api/projects/${id}/restore`, { method: "POST" }),
  projectSummary: (id: string): Promise<ProjectSummary> =>
    request(`/api/projects/${id}/summary`),
  listDocuments: (
    id: string,
    options: { query?: string; includeVersions?: boolean } = {},
  ): Promise<DocumentPage> =>
    request(
      `/api/projects/${id}/documents${queryString({
        limit: 500,
        query: options.query,
        include_versions: options.includeVersions,
      })}`,
    ),
  scanDocuments: (id: string): Promise<ScanSummary> =>
    request(`/api/projects/${id}/documents/scan`, { method: "POST" }),
  previewDocument: (
    projectId: string,
    documentId: string,
  ): Promise<DocumentPreview> =>
    request(`/api/projects/${projectId}/documents/${documentId}`),
  removeDocument: (projectId: string, documentId: string): Promise<void> =>
    request(`/api/projects/${projectId}/documents/${documentId}`, {
      method: "DELETE",
    }),
  searchDocuments: (
    projectId: string,
    query: string,
    includeSuperseded = false,
  ): Promise<SearchResponse> =>
    request(
      `/api/projects/${projectId}/documents/search${queryString({
        query,
        limit: 30,
        include_superseded: includeSuperseded,
      })}`,
    ),
  askProject: (
    projectId: string,
    message: string,
    mode: ChatMode,
    conversationId?: string,
  ): Promise<ChatResponse> =>
    request(`/api/projects/${projectId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message, mode, conversation_id: conversationId }),
    }),
  listConversations: (projectId: string): Promise<Conversation[]> =>
    request(`/api/projects/${projectId}/conversations`),
  getConversation: (
    projectId: string,
    conversationId: string,
  ): Promise<Conversation> =>
    request(`/api/projects/${projectId}/conversations/${conversationId}`),
  listReviews: (projectId: string): Promise<ReviewRecord[]> =>
    request(`/api/projects/${projectId}/reviews`),
  createReview: (
    projectId: string,
    payload: ReviewPayload,
  ): Promise<ReviewRecord> =>
    request(`/api/projects/${projectId}/reviews`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getSettings: (): Promise<ApplicationSettings> => request("/api/settings"),
  updateSettings: (
    payload: Partial<ApplicationSettings>,
  ): Promise<ApplicationSettings> =>
    request("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  providerStatus: (): Promise<ProviderStatus> => request("/api/provider"),
  saveProviderKey: (apiKey: string): Promise<ProviderStatus> =>
    request("/api/provider/key", {
      method: "PUT",
      body: JSON.stringify({ api_key: apiKey }),
    }),
  removeProviderKey: (): Promise<void> =>
    request("/api/provider/key", { method: "DELETE" }),
  testProvider: (): Promise<ProviderTestResult> =>
    request("/api/provider/test", { method: "POST" }),
  maintenanceInfo: (): Promise<MaintenanceInfo> => request("/api/maintenance"),
  createBackup: (): Promise<Backup> =>
    request("/api/maintenance/backup", { method: "POST" }),
};
