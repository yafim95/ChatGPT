"""Rotating technical logs that exclude request and document content."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path


class JsonFormatter(logging.Formatter):
    def __init__(self, secrets: tuple[str, ...]) -> None:
        super().__init__()
        self._secrets = tuple(secret for secret in secrets if secret)

    def format(self, record: logging.LogRecord) -> str:
        message = record.getMessage()
        for secret in self._secrets:
            message = message.replace(secret, "[REDACTED]")
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": message,
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(log_dir: Path, level: str, secrets: tuple[str, ...]) -> None:
    root = logging.getLogger()
    root.setLevel(level.upper())

    for handler in list(root.handlers):
        if getattr(handler, "_projectmind_handler", False):
            root.removeHandler(handler)
            handler.close()

    handler = RotatingFileHandler(
        log_dir / "application.log",
        maxBytes=2 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    handler.setFormatter(JsonFormatter(secrets))
    handler._projectmind_handler = True  # type: ignore[attr-defined]
    root.addHandler(handler)


def set_diagnostic_logging_enabled(enabled: bool) -> None:
    """Enable or silence ProjectMind's rotating backend file handler."""
    disabled_level = logging.CRITICAL + 1
    for handler in logging.getLogger().handlers:
        if getattr(handler, "_projectmind_handler", False):
            handler.setLevel(logging.NOTSET if enabled else disabled_level)
