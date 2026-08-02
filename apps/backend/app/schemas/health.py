from __future__ import annotations

from datetime import datetime
from typing import Literal

from app.schemas.common import ApiModel


class HealthResponse(ApiModel):
    status: Literal["ok"]
    version: str
    database: Literal["ok"]
    environment: str
    timestamp: datetime


class LiveResponse(ApiModel):
    status: Literal["alive"]
