import { getBackendBootstrap } from "./bootstrap";
import type {
  ApiErrorPayload,
  ApplicationSettings,
  HealthResponse,
  Project,
  ProjectPage,
  ProjectPayload,
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
  if (init?.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

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

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  health: (): Promise<HealthResponse> => request("/api/health"),
  listProjects: (): Promise<ProjectPage> =>
    request("/api/projects?limit=100&offset=0"),
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
  archiveProject: (id: string): Promise<void> =>
    request(`/api/projects/${id}`, { method: "DELETE" }),
  getSettings: (): Promise<ApplicationSettings> => request("/api/settings"),
  updateSettings: (
    payload: Partial<
      Pick<ApplicationSettings, "brand_name" | "theme" | "locale">
    >,
  ): Promise<ApplicationSettings> =>
    request("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
