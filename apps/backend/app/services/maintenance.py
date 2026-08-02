from __future__ import annotations

import asyncio
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import AppConfig
from app.core.secrets import SecretStore
from app.models.knowledge import Conversation, Document, ReviewRecord
from app.models.project import Project
from app.models.settings import ApplicationSettings
from app.schemas.knowledge import BackupRead, DashboardSummary, MaintenanceInfo
from app.services.audit import record_audit


def _backup_database(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source) as source_connection:
        with sqlite3.connect(destination) as destination_connection:
            source_connection.backup(destination_connection)


def create_pre_migration_backup(
    config: AppConfig,
    target_revision: str,
) -> Path | None:
    """Create a consistent safety copy before upgrading an older database."""
    source = config.database_path
    if not source.is_file() or source.stat().st_size == 0:
        return None
    revision: str | None = None
    try:
        with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as connection:
            row = connection.execute("SELECT version_num FROM alembic_version").fetchone()
            revision = str(row[0]) if row else None
    except sqlite3.DatabaseError:
        # A partially initialized database still deserves a safety copy.
        revision = None
    if revision == target_revision:
        return None
    timestamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S-%f")
    destination = (
        config.data_dir / "backups" / f"projectmind-backup-{timestamp}-pre-{config.app_version}.db"
    )
    _backup_database(source, destination)
    return destination


class MaintenanceService:
    @staticmethod
    def _backup_read(path: Path) -> BackupRead:
        stat = path.stat()
        return BackupRead(
            path=str(path),
            file_name=path.name,
            size_bytes=stat.st_size,
            created_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC),
        )

    def list_backups(self, config: AppConfig) -> list[BackupRead]:
        backup_dir = config.data_dir / "backups"
        if not backup_dir.exists():
            return []
        files = sorted(backup_dir.glob("projectmind-backup-*.db"), reverse=True)
        return [self._backup_read(path) for path in files[:50]]

    async def create_backup(
        self,
        session: AsyncSession,
        config: AppConfig,
    ) -> BackupRead:
        settings = await session.scalar(
            select(ApplicationSettings).where(ApplicationSettings.id == 1)
        )
        retention = settings.backup_retention_count if settings else 10
        timestamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S-%f")
        destination = config.data_dir / "backups" / f"projectmind-backup-{timestamp}.db"
        await asyncio.to_thread(_backup_database, config.database_path, destination)
        backups = sorted(
            (config.data_dir / "backups").glob("projectmind-backup-*.db"),
            reverse=True,
        )
        for expired in backups[retention:]:
            await asyncio.to_thread(expired.unlink)
        record_audit(
            session,
            action="backup.created",
            target_type="application",
            target_id="1",
            details={"file_name": destination.name},
        )
        await session.commit()
        return self._backup_read(destination)

    async def maybe_create_automatic_backup(
        self,
        session: AsyncSession,
        config: AppConfig,
    ) -> BackupRead | None:
        settings = await session.scalar(
            select(ApplicationSettings).where(ApplicationSettings.id == 1)
        )
        if settings is None or not settings.auto_backup_enabled:
            return None
        existing = self.list_backups(config)
        if existing and datetime.now(UTC) - existing[0].created_at < timedelta(
            days=settings.backup_interval_days
        ):
            return None
        return await self.create_backup(session, config)

    def info(self, config: AppConfig) -> MaintenanceInfo:
        return MaintenanceInfo(
            data_directory=str(config.data_dir),
            database_path=str(config.database_path),
            logs_directory=str(config.data_dir / "logs"),
            backup_directory=str(config.data_dir / "backups"),
            database_size_bytes=(
                config.database_path.stat().st_size if config.database_path.exists() else 0
            ),
            backups=self.list_backups(config),
        )


class DashboardService:
    @staticmethod
    async def summary(
        session: AsyncSession,
        secret_store: SecretStore,
    ) -> DashboardSummary:
        active_projects = await session.scalar(
            select(func.count(Project.id)).where(Project.deleted_at.is_(None))
        )
        documents = await session.scalar(
            select(func.count(Document.id)).where(
                Document.is_current.is_(True),
                Document.is_missing.is_(False),
                Document.extraction_status == "ready",
            )
        )
        conversations = await session.scalar(select(func.count(Conversation.id)))
        reviews = await session.scalar(select(func.count(ReviewRecord.id)))
        return DashboardSummary(
            active_project_count=active_projects or 0,
            indexed_document_count=documents or 0,
            conversation_count=conversations or 0,
            review_count=reviews or 0,
            ai_configured=secret_store.configured(),
        )
