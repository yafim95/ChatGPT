from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import ApiModel


class DirectoryBreadcrumb(ApiModel):
    label: str
    relative_path: str


class ProjectFileEntry(ApiModel):
    name: str
    relative_path: str
    absolute_path: str
    kind: Literal["file", "directory"]
    extension: str | None
    size_bytes: int | None
    modified_at: datetime
    supported: bool
    indexed_document_id: str | None = None
    extraction_status: str | None = None
    workflow_state: str = "unreviewed"
    review_code: str | None = None
    is_core_memory: bool = False
    memory_category: str | None = None
    related_chat_count: int = 0
    review_count: int = 0
    crs_count: int = 0


class DirectoryListing(ApiModel):
    workspace_name: str
    current_path: str
    parent_path: str | None
    breadcrumbs: list[DirectoryBreadcrumb]
    items: list[ProjectFileEntry]
    total: int
    truncated: bool = False
    query: str | None = None


class DocumentWorkflowUpdate(ApiModel):
    is_core_memory: bool | None = None
    memory_category: str | None = Field(default=None, max_length=80)
    workflow_state: Literal["unreviewed", "under_review", "closed"] | None = None
    review_code: str | None = Field(default=None, max_length=20)


class RelatedConversation(ApiModel):
    id: str
    title: str
    mode: str
    relation_type: str
    updated_at: datetime
    message_count: int


class RelatedReview(ApiModel):
    id: str
    title: str
    review_type: str
    workflow_state: str
    decision_code: str | None
    updated_at: datetime


class RelatedCrs(ApiModel):
    id: str
    title: str
    status: str
    open_item_count: int
    updated_at: datetime


class DocumentRelationships(ApiModel):
    conversations: list[RelatedConversation]
    reviews: list[RelatedReview]
    crs_sheets: list[RelatedCrs]


class CrsCreate(ApiModel):
    document_id: str = Field(max_length=36)
    review_id: str | None = Field(default=None, max_length=36)
    title: str = Field(min_length=2, max_length=200)
    reference_number: str | None = Field(default=None, max_length=120)
    revision: str | None = Field(default=None, max_length=40)


class CrsUpdate(ApiModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    reference_number: str | None = Field(default=None, max_length=120)
    revision: str | None = Field(default=None, max_length=40)
    status: Literal["open", "closed"] | None = None


class CrsItemCreate(ApiModel):
    location: str | None = Field(default=None, max_length=200)
    consultant_comment: str = Field(min_length=2, max_length=20000)
    contractor_reply: str | None = Field(default=None, max_length=20000)
    consultant_response: str | None = Field(default=None, max_length=20000)
    status: Literal["open", "closed"] = "open"


class CrsItemUpdate(ApiModel):
    location: str | None = Field(default=None, max_length=200)
    consultant_comment: str | None = Field(default=None, min_length=2, max_length=20000)
    contractor_reply: str | None = Field(default=None, max_length=20000)
    consultant_response: str | None = Field(default=None, max_length=20000)
    status: Literal["open", "closed"] | None = None


class CrsItemRead(ApiModel):
    id: str
    sheet_id: str
    item_number: int
    location: str | None
    consultant_comment: str
    contractor_reply: str | None
    consultant_response: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class CrsRead(ApiModel):
    id: str
    project_id: str
    document_id: str
    review_id: str | None
    document_file_name: str | None = None
    title: str
    reference_number: str | None
    revision: str | None
    status: str
    items: list[CrsItemRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
