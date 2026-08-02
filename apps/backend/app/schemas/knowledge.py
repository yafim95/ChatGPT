from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import ApiModel


class DocumentRead(ApiModel):
    id: str
    project_id: str
    revision_group_id: str
    relative_path: str
    absolute_path: str
    file_name: str
    extension: str
    mime_type: str | None
    sha256: str
    duplicate_of_id: str | None
    size_bytes: int
    source_modified_at: datetime
    page_count: int | None
    word_count: int
    extraction_status: str
    extraction_error: str | None
    version_number: int
    is_current: bool
    is_missing: bool
    is_core_memory: bool
    memory_category: str | None
    workflow_state: str
    review_code: str | None
    review_closed_at: datetime | None
    related_chat_count: int = 0
    review_count: int = 0
    crs_count: int = 0
    created_at: datetime
    updated_at: datetime


class DocumentPreview(ApiModel):
    document: DocumentRead
    text: str
    truncated: bool


class DocumentPage(ApiModel):
    items: list[DocumentRead]
    total: int
    limit: int
    offset: int


class ScanSummary(ApiModel):
    discovered: int
    added: int
    updated: int
    unchanged: int
    failed: int
    missing: int
    supported_extensions: list[str]
    completed_at: datetime


class ReindexSummary(ApiModel):
    documents: int
    passages: int
    completed_at: datetime


class SearchResult(ApiModel):
    chunk_id: str | None = None
    document_id: str
    sha256: str
    file_name: str
    relative_path: str
    version_number: int
    chunk_index: int = 0
    excerpt: str
    score: float
    source_tier: str = "project"


class SearchResponse(ApiModel):
    query: str
    results: list[SearchResult]
    total: int


class CitationSource(ApiModel):
    reference: str
    document_id: str
    file_name: str
    relative_path: str
    version_number: int
    chunk_index: int = 0
    excerpt: str
    source_tier: str = "project"


class ChatRequest(ApiModel):
    message: str = Field(min_length=2, max_length=12000)
    conversation_id: str | None = Field(default=None, max_length=36)
    mode: Literal["evidence", "project", "general"] = "evidence"
    document_ids: list[str] = Field(default_factory=list, max_length=20)
    include_core_memory: bool = True
    conversation_title: str | None = Field(default=None, min_length=2, max_length=200)


class ChatResponse(ApiModel):
    conversation_id: str | None
    message: str
    sources: list[CitationSource]
    model: str
    local_only: bool = False


class ChatMessageRead(ApiModel):
    id: str
    role: str
    content: str
    sources: list[dict[str, object]]
    created_at: datetime


class ConversationDocumentRead(ApiModel):
    document_id: str
    relation_type: str
    file_name: str
    relative_path: str


class ConversationRead(ApiModel):
    id: str
    project_id: str
    title: str
    mode: str
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessageRead] = Field(default_factory=list)
    documents: list[ConversationDocumentRead] = Field(default_factory=list)


class ReviewCreate(ApiModel):
    title: str = Field(min_length=2, max_length=200)
    review_type: Literal[
        "material_submittal",
        "method_statement",
        "itp",
        "shop_drawing",
        "technical_report",
        "general",
    ]
    instructions: str = Field(min_length=5, max_length=12000)
    document_id: str | None = Field(default=None, max_length=36)
    reference_number: str | None = Field(default=None, max_length=120)
    discipline: str | None = Field(default=None, max_length=80)
    decision_code: str | None = Field(default=None, max_length=20)
    due_at: datetime | None = None
    generate_with_ai: bool = True
    create_crs: bool = True


class ReviewUpdate(ApiModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    reference_number: str | None = Field(default=None, max_length=120)
    discipline: str | None = Field(default=None, max_length=80)
    result: str | None = Field(default=None, max_length=100000)
    status: Literal["draft", "final"] | None = None
    workflow_state: Literal["open", "closed"] | None = None
    decision_code: str | None = Field(default=None, max_length=20)
    due_at: datetime | None = None


class ReviewRead(ApiModel):
    id: str
    project_id: str
    title: str
    document_id: str | None
    document_file_name: str | None = None
    conversation_id: str | None
    review_type: str
    reference_number: str | None
    discipline: str | None
    instructions: str
    result: str
    sources: list[dict[str, object]]
    status: str
    workflow_state: str
    decision_code: str | None
    due_at: datetime | None
    closed_at: datetime | None
    crs_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ProjectSummary(ApiModel):
    project_id: str
    document_count: int
    current_document_count: int
    failed_document_count: int
    missing_document_count: int
    conversation_count: int
    review_count: int
    open_review_count: int
    core_memory_count: int
    open_crs_item_count: int
    workspace_configured: bool
    last_indexed_at: datetime | None


class DashboardSummary(ApiModel):
    active_project_count: int
    indexed_document_count: int
    conversation_count: int
    review_count: int
    ai_configured: bool


class ProviderKeyUpdate(ApiModel):
    api_key: str = Field(min_length=8, max_length=500)


class ProviderStatus(ApiModel):
    configured: bool
    provider: str
    base_url: str
    model: str
    external_ai_enabled: bool


class ProviderTestResult(ApiModel):
    success: bool
    message: str
    model: str


class BackupRead(ApiModel):
    path: str
    file_name: str
    size_bytes: int
    created_at: datetime


class MaintenanceInfo(ApiModel):
    data_directory: str
    database_path: str
    logs_directory: str
    backup_directory: str
    database_size_bytes: int
    backups: list[BackupRead]
