"""Project identity and its controlled defaults."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


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

    project: Mapped[Project] = relationship(back_populates="settings")
