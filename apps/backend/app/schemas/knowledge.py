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


class SearchResult(ApiModel):
    document_id: str
    sha256: str
    file_name: str
    relative_path: str
    version_number: int
    excerpt: str
    score: float


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
    excerpt: str


class ChatRequest(ApiModel):
    message: str = Field(min_length=2, max_length=12000)
    conversation_id: str | None = Field(default=None, max_length=36)
    mode: Literal["evidence", "project", "general"] = "evidence"


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


class ConversationRead(ApiModel):
    id: str
    project_id: str
    title: str
    mode: str
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessageRead] = Field(default_factory=list)


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


class ReviewRead(ApiModel):
    id: str
    project_id: str
    title: str
    review_type: str
    instructions: str
    result: str
    sources: list[dict[str, object]]
    status: str
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
