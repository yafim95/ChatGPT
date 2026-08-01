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
  workspace_path: string | null;
  include_subfolders: boolean;
  auto_scan_enabled: boolean;
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
  settings?: Partial<ProjectSettings>;
}

export interface ApplicationSettings {
  brand_name: string;
  theme: "light" | "dark" | "system";
  locale: string;
  telemetry_enabled: boolean;
  auto_backup_enabled: boolean;
  backup_interval_days: number;
  backup_retention_count: number;
  start_view: "home" | "projects" | "last";
  compact_navigation: boolean;
  external_ai_enabled: boolean;
  ai_provider: "moonshot" | "openai_compatible";
  ai_base_url: string;
  ai_model: string;
  ai_reasoning_effort: "low" | "high" | "max";
  ai_timeout_seconds: number;
  ai_max_output_tokens: number;
  retrieval_result_limit: number;
  include_superseded_search: boolean;
  save_chat_history: boolean;
  default_project_root: string | null;
  diagnostic_logging_enabled: boolean;
  ai_api_key_configured: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  active_project_count: number;
  indexed_document_count: number;
  conversation_count: number;
  review_count: number;
  ai_configured: boolean;
}

export interface ProjectSummary {
  project_id: string;
  document_count: number;
  current_document_count: number;
  failed_document_count: number;
  missing_document_count: number;
  conversation_count: number;
  review_count: number;
  workspace_configured: boolean;
  last_indexed_at: string | null;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  revision_group_id: string;
  relative_path: string;
  absolute_path: string;
  file_name: string;
  extension: string;
  mime_type: string | null;
  sha256: string;
  duplicate_of_id: string | null;
  size_bytes: number;
  source_modified_at: string;
  page_count: number | null;
  word_count: number;
  extraction_status: "ready" | "failed" | "no_text" | "pending" | "removed";
  extraction_error: string | null;
  version_number: number;
  is_current: boolean;
  is_missing: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentPage {
  items: ProjectDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface DocumentPreview {
  document: ProjectDocument;
  text: string;
  truncated: boolean;
}

export interface ScanSummary {
  discovered: number;
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
  missing: number;
  supported_extensions: string[];
  completed_at: string;
}

export interface SearchResult {
  document_id: string;
  sha256: string;
  file_name: string;
  relative_path: string;
  version_number: number;
  excerpt: string;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

export interface CitationSource {
  reference: string;
  document_id: string;
  file_name: string;
  relative_path: string;
  version_number: number;
  excerpt: string;
}

export type ChatMode = "evidence" | "project" | "general";

export interface ChatResponse {
  conversation_id: string | null;
  message: string;
  sources: CitationSource[];
  model: string;
  local_only: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Array<Record<string, unknown>>;
  created_at: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  title: string;
  mode: ChatMode;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export type ReviewType =
  | "material_submittal"
  | "method_statement"
  | "itp"
  | "shop_drawing"
  | "technical_report"
  | "general";

export interface ReviewPayload {
  title: string;
  review_type: ReviewType;
  instructions: string;
}

export interface ReviewRecord extends ReviewPayload {
  id: string;
  project_id: string;
  result: string;
  sources: Array<Record<string, unknown>>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderStatus {
  configured: boolean;
  provider: string;
  base_url: string;
  model: string;
  external_ai_enabled: boolean;
}

export interface ProviderTestResult {
  success: boolean;
  message: string;
  model: string;
}

export interface Backup {
  path: string;
  file_name: string;
  size_bytes: number;
  created_at: string;
}

export interface MaintenanceInfo {
  data_directory: string;
  database_path: string;
  logs_directory: string;
  backup_directory: string;
  database_size_bytes: number;
  backups: Backup[];
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details: Array<Record<string, unknown>>;
    trace_id: string;
  };
}
