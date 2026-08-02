from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field, HttpUrl, field_validator

from app.schemas.common import ApiModel


class ApplicationSettingsUpdate(ApiModel):
    brand_name: str | None = Field(default=None, min_length=2, max_length=120)
    theme: Literal["light", "dark", "system"] | None = None
    locale: str | None = Field(default=None, min_length=2, max_length=20)
    auto_backup_enabled: bool | None = None
    backup_interval_days: int | None = Field(default=None, ge=1, le=90)
    backup_retention_count: int | None = Field(default=None, ge=1, le=50)
    start_view: Literal["home", "projects", "last"] | None = None
    compact_navigation: bool | None = None
    visual_style: Literal["glass", "solid"] | None = None
    interface_density: Literal["comfortable", "compact"] | None = None
    reduce_motion: bool | None = None
    external_ai_enabled: bool | None = None
    ai_provider: Literal["moonshot", "openai_compatible"] | None = None
    ai_base_url: HttpUrl | None = None
    ai_model: str | None = Field(default=None, min_length=1, max_length=120)
    ai_reasoning_effort: Literal["low", "high", "max"] | None = None
    ai_timeout_seconds: int | None = Field(default=None, ge=10, le=300)
    ai_max_output_tokens: int | None = Field(default=None, ge=256, le=131072)
    retrieval_result_limit: int | None = Field(default=None, ge=1, le=30)
    rag_chunk_size: int | None = Field(default=None, ge=600, le=6000)
    rag_chunk_overlap: int | None = Field(default=None, ge=0, le=1200)
    core_memory_result_limit: int | None = Field(default=None, ge=1, le=30)
    selected_document_result_limit: int | None = Field(default=None, ge=1, le=40)
    max_context_characters: int | None = Field(default=None, ge=12000, le=800000)
    chat_history_message_limit: int | None = Field(default=None, ge=2, le=60)
    auto_include_core_memory: bool | None = None
    include_superseded_search: bool | None = None
    save_chat_history: bool | None = None
    default_project_root: str | None = Field(default=None, max_length=2000)
    show_hidden_files: bool | None = None
    max_index_file_size_mb: int | None = Field(default=None, ge=1, le=500)
    diagnostic_logging_enabled: bool | None = None

    @field_validator("brand_name", "ai_model", "default_project_root", mode="before")
    @classmethod
    def _strip_optional_strings(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        return stripped or None

    @field_validator("ai_base_url")
    @classmethod
    def _validate_provider_url(cls, value: HttpUrl | None) -> HttpUrl | None:
        if value is None:
            return None
        if value.username or value.password:
            raise ValueError("Provider URLs cannot contain embedded credentials.")
        if value.query or value.fragment:
            raise ValueError("Provider URLs cannot contain a query string or fragment.")
        host = (value.host or "").casefold()
        loopback_hosts = {"localhost", "127.0.0.1", "::1", "[::1]"}
        if value.scheme != "https" and host not in loopback_hosts:
            raise ValueError("Use HTTPS for remote AI provider endpoints.")
        path = (value.path or "").rstrip("/").casefold()
        if path.endswith("/chat/completions") or path.endswith("/models"):
            raise ValueError("Enter the API base URL, normally ending in /v1.")
        return value


class ApplicationSettingsRead(ApiModel):
    brand_name: str
    theme: str
    locale: str
    telemetry_enabled: bool
    auto_backup_enabled: bool
    backup_interval_days: int
    backup_retention_count: int
    start_view: str
    compact_navigation: bool
    visual_style: str
    interface_density: str
    reduce_motion: bool
    external_ai_enabled: bool
    ai_provider: str
    ai_base_url: str
    ai_model: str
    ai_reasoning_effort: str
    ai_timeout_seconds: int
    ai_max_output_tokens: int
    retrieval_result_limit: int
    rag_chunk_size: int
    rag_chunk_overlap: int
    core_memory_result_limit: int
    selected_document_result_limit: int
    max_context_characters: int
    chat_history_message_limit: int
    auto_include_core_memory: bool
    include_superseded_search: bool
    save_chat_history: bool
    default_project_root: str | None
    show_hidden_files: bool
    max_index_file_size_mb: int
    diagnostic_logging_enabled: bool
    ai_api_key_configured: bool = False
    created_at: datetime
    updated_at: datetime
