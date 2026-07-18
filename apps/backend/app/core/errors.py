"""Domain errors and the public API error envelope."""

from __future__ import annotations

from typing import Any


class ProjectMindError(Exception):
    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        details: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []


class NotFoundError(ProjectMindError):
    def __init__(self, resource: str) -> None:
        super().__init__(
            status_code=404,
            code="not_found",
            message=f"{resource} was not found.",
        )


class ConflictError(ProjectMindError):
    def __init__(self, message: str) -> None:
        super().__init__(status_code=409, code="conflict", message=message)
