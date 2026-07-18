"""Alembic execution for source and PyInstaller layouts."""

from __future__ import annotations

import sys
from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import AppConfig


def _resource_root() -> Path:
    bundle_root = getattr(sys, "_MEIPASS", None)
    if bundle_root:
        return Path(bundle_root)
    return Path(__file__).resolve().parents[2]


def run_migrations(settings: AppConfig) -> None:
    root = _resource_root()
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    config.set_main_option("sqlalchemy.url", settings.sync_database_url.replace("%", "%%"))
    command.upgrade(config, "head")
