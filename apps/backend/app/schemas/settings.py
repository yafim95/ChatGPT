from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import ApiModel


class ApplicationSettingsUpdate(ApiModel):
    brand_name: str | None = Field(default=None, min_length=2, max_length=120)
    theme: Literal["light", "dark", "system"] | None = None
    locale: str | None = Field(default=None, min_length=2, max_length=20)
    telemetry_enabled: bool | None = None
    auto_backup_enabled: bool | None = None
    backup_interval_days: int | None = Field(default=None, ge=1, le=90)


class ApplicationSettingsRead(ApiModel):
    brand_name: str
    theme: str
    locale: str
    telemetry_enabled: bool
    auto_backup_enabled: bool
    backup_interval_days: int
    created_at: datetime
    updated_at: datetime
