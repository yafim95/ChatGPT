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
  excluded_patterns: string[];
  ai_project_instructions: string | null;
  auto_create_crs: boolean;
  default_review_due_days: number;
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
  visual_style: "glass" | "solid";
  interface_density: "comfortable" | "compact";
  reduce_motion: boolean;
  external_ai_enabled: boolean;
  ai_provider: "moonshot" | "openai_compatible";
  ai_base_url: string;
  ai_model: string;
  ai_reasoning_effort: "low" | "high" | "max";
  ai_timeout_seconds: number;
  ai_max_output_tokens: number;
  retrieval_result_limit: number;
  rag_chunk_size: number;
  rag_chunk_overlap: number;
  core_memory_result_limit: number;
  selected_document_result_limit: number;
  max_context_characters: number;
  chat_history_message_limit: number;
  auto_include_core_memory: boolean;
  include_superseded_search: boolean;
  save_chat_history: boolean;
  default_project_root: string | null;
  show_hidden_files: boolean;
  max_index_file_size_mb: number;
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
  open_review_count: number;
  core_memory_count: number;
  open_crs_item_count: number;
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
  is_core_memory: boolean;
  memory_category: string | null;
  workflow_state: DocumentWorkflowState;
  review_code: string | null;
  review_closed_at: string | null;
  related_chat_count: number;
  review_count: number;
  crs_count: number;
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

export interface ReindexSummary {
  documents: number;
  passages: number;
  completed_at: string;
}

export interface SearchResult {
  chunk_id: string | null;
  document_id: string;
  sha256: string;
  file_name: string;
  relative_path: string;
  version_number: number;
  chunk_index: number;
  excerpt: string;
  score: number;
  source_tier: RetrievalTier;
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
  chunk_index: number;
  excerpt: string;
  source_tier: RetrievalTier;
}

export type RetrievalTier = "selected" | "core_memory" | "project";
export type DocumentWorkflowState = "unreviewed" | "under_review" | "closed";

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
  documents: ConversationDocument[];
}

export interface ConversationDocument {
  document_id: string;
  relation_type: "context" | "memory" | "evidence";
  file_name: string;
  relative_path: string;
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
  document_id?: string | null;
  reference_number?: string | null;
  discipline?: string | null;
  decision_code?: string | null;
  due_at?: string | null;
  generate_with_ai?: boolean;
  create_crs?: boolean;
}

export interface ReviewRecord extends ReviewPayload {
  id: string;
  project_id: string;
  document_id: string | null;
  document_file_name: string | null;
  conversation_id: string | null;
  reference_number: string | null;
  discipline: string | null;
  result: string;
  sources: Array<Record<string, unknown>>;
  status: string;
  workflow_state: "open" | "closed";
  decision_code: string | null;
  due_at: string | null;
  closed_at: string | null;
  crs_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ReviewUpdatePayload {
  title?: string;
  reference_number?: string | null;
  discipline?: string | null;
  result?: string;
  status?: "draft" | "final";
  workflow_state?: "open" | "closed";
  decision_code?: string | null;
  due_at?: string | null;
}

export interface DirectoryBreadcrumb {
  label: string;
  relative_path: string;
}

export interface ProjectFileEntry {
  name: string;
  relative_path: string;
  absolute_path: string;
  kind: "file" | "directory";
  extension: string | null;
  size_bytes: number | null;
  modified_at: string;
  supported: boolean;
  indexed_document_id: string | null;
  extraction_status: string | null;
  workflow_state: DocumentWorkflowState;
  review_code: string | null;
  is_core_memory: boolean;
  memory_category: string | null;
  related_chat_count: number;
  review_count: number;
  crs_count: number;
}

export interface DirectoryListing {
  workspace_name: string;
  current_path: string;
  parent_path: string | null;
  breadcrumbs: DirectoryBreadcrumb[];
  items: ProjectFileEntry[];
  total: number;
  truncated: boolean;
  query: string | null;
}

export interface DocumentWorkflowUpdate {
  is_core_memory?: boolean;
  memory_category?: string | null;
  workflow_state?: DocumentWorkflowState;
  review_code?: string | null;
}

export interface RelatedConversation {
  id: string;
  title: string;
  mode: string;
  relation_type: string;
  updated_at: string;
  message_count: number;
}

export interface RelatedReview {
  id: string;
  title: string;
  review_type: string;
  workflow_state: string;
  decision_code: string | null;
  updated_at: string;
}

export interface RelatedCrs {
  id: string;
  title: string;
  status: string;
  open_item_count: number;
  updated_at: string;
}

export interface DocumentRelationships {
  conversations: RelatedConversation[];
  reviews: RelatedReview[];
  crs_sheets: RelatedCrs[];
}

export interface CrsItem {
  id: string;
  sheet_id: string;
  item_number: number;
  location: string | null;
  consultant_comment: string;
  contractor_reply: string | null;
  consultant_response: string | null;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
}

export interface CrsSheet {
  id: string;
  project_id: string;
  document_id: string;
  review_id: string | null;
  document_file_name: string | null;
  title: string;
  reference_number: string | null;
  revision: string | null;
  status: "open" | "closed";
  items: CrsItem[];
  created_at: string;
  updated_at: string;
}

export interface CrsCreatePayload {
  document_id: string;
  review_id?: string | null;
  title: string;
  reference_number?: string | null;
  revision?: string | null;
}

export interface CrsItemPayload {
  location?: string | null;
  consultant_comment: string;
  contractor_reply?: string | null;
  consultant_response?: string | null;
  status?: "open" | "closed";
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
