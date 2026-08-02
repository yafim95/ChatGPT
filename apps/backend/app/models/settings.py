"""Application-wide, non-secret preferences."""

from __future__ import annotations

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ApplicationSettings(TimestampMixin, Base):
    __tablename__ = "application_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    brand_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        default="ProjectMind Engineering AI",
    )
    theme: Mapped[str] = mapped_column(String(20), nullable=False, default="system")
    locale: Mapped[str] = mapped_column(String(20), nullable=False, default="en-AE")
    telemetry_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auto_backup_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    backup_interval_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    backup_retention_count: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    start_view: Mapped[str] = mapped_column(String(30), nullable=False, default="last")
    compact_navigation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    visual_style: Mapped[str] = mapped_column(String(30), nullable=False, default="glass")
    interface_density: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="comfortable",
    )
    reduce_motion: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    external_ai_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ai_provider: Mapped[str] = mapped_column(String(40), nullable=False, default="moonshot")
    ai_base_url: Mapped[str] = mapped_column(
        String(300),
        nullable=False,
        default="https://api.moonshot.ai/v1",
    )
    ai_model: Mapped[str] = mapped_column(String(120), nullable=False, default="kimi-k3")
    ai_reasoning_effort: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="high",
    )
    ai_timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=180)
    ai_max_output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=16000)
    retrieval_result_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    rag_chunk_size: Mapped[int] = mapped_column(Integer, nullable=False, default=1800)
    rag_chunk_overlap: Mapped[int] = mapped_column(Integer, nullable=False, default=240)
    core_memory_result_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    selected_document_result_limit: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=8,
    )
    max_context_characters: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=90000,
    )
    chat_history_message_limit: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=16,
    )
    auto_include_core_memory: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    include_superseded_search: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    save_chat_history: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    default_project_root: Mapped[str | None] = mapped_column(Text)
    show_hidden_files: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    max_index_file_size_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=150)
    diagnostic_logging_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
