export interface HealthResponse {
  status: "ok";
  version: string;
  database: "ok";
  environment: string;
  timestamp: string;
}

export interface ProjectSettings {
  timezone: string;
  locale: string;
  disciplines: string[];
  review_codes: Array<{ code: string; label: string }>;
  document_hierarchy: string[];
  document_precedence: string[];
}

export interface Project {
  id: string;
  name: string;
  project_number: string;
  client: string | null;
  consultant: string | null;
  contractor: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  settings: ProjectSettings;
}

export interface ProjectPage {
  items: Project[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProjectPayload {
  name: string;
  project_number: string;
  client?: string | null;
  consultant?: string | null;
  contractor?: string | null;
  description?: string | null;
}

export interface ApplicationSettings {
  brand_name: string;
  theme: "light" | "dark" | "system";
  locale: string;
  telemetry_enabled: boolean;
  auto_backup_enabled: boolean;
  backup_interval_days: number;
  created_at: string;
  updated_at: string;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details: Array<Record<string, unknown>>;
    trace_id: string;
  };
}
