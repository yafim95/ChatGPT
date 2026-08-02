"""Project identity and its controlled defaults."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.knowledge import CommentReplySheet, Conversation, Document, ReviewRecord


class Project(TimestampMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        Index("ix_projects_name", "name"),
        Index("ix_projects_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    project_number: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    client: Mapped[str | None] = mapped_column(String(200))
    consultant: Mapped[str | None] = mapped_column(String(200))
    contractor: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    settings: Mapped[ProjectSettings] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="selectin",
    )
    documents: Mapped[list[Document]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    conversations: Mapped[list[Conversation]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    reviews: Mapped[list[ReviewRecord]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    crs_sheets: Mapped[list[CommentReplySheet]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        lazy="raise",
    )


class ProjectSettings(Base):
    __tablename__ = "project_settings"

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    timezone: Mapped[str] = mapped_column(String(80), nullable=False, default="Asia/Dubai")
    locale: Mapped[str] = mapped_column(String(20), nullable=False, default="en-AE")
    disciplines: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    review_codes: Mapped[list[dict[str, str]]] = mapped_column(JSON, nullable=False, default=list)
    document_hierarchy: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    document_precedence: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    workspace_path: Mapped[str | None] = mapped_column(Text)
    include_subfolders: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    auto_scan_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    excluded_patterns: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    ai_project_instructions: Mapped[str | None] = mapped_column(Text)
    auto_create_crs: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    default_review_due_days: Mapped[int] = mapped_column(Integer, nullable=False, default=14)

    project: Mapped[Project] = relationship(back_populates="settings")
