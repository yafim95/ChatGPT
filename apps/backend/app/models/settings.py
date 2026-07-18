"""Application-wide, non-secret preferences."""

from __future__ import annotations

from sqlalchemy import Boolean, Integer, String
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
