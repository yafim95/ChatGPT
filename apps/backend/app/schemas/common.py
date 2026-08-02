from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class Page[T](ApiModel):
    items: list[T]
    total: int
    limit: int
    offset: int
