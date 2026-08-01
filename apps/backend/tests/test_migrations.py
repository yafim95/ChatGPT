from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from app.core.config import AppConfig, Environment
from app.database.migrations import run_migrations
from app.models.project import Project
from fastapi import FastAPI
from pydantic import SecretStr
from sqlalchemy import create_engine, inspect, text


async def test_product_migrations_created_expected_tables(
    app: FastAPI,
    tmp_path: Path,
) -> None:
    database = app.state.database
    async with database.engine.connect() as connection:
        tables = await connection.run_sync(
            lambda sync_connection: inspect(sync_connection).get_table_names()
        )

    assert {
        "alembic_version",
        "application_settings",
        "audit_events",
        "chat_messages",
        "conversations",
        "document_search",
        "documents",
        "project_settings",
        "projects",
        "review_records",
    }.issubset(set(tables))
    application_log = (tmp_path / "logs" / "application.log").read_text(encoding="utf-8")
    assert '"logger": "alembic.runtime.migration"' in application_log
    assert "Running upgrade  -> 20260718_0001" in application_log
    assert "Running upgrade 20260718_0001 -> 20260801_0002" in application_log


def test_product_migration_recovers_interrupted_initialization(tmp_path: Path) -> None:
    settings = AppConfig(
        environment=Environment.TEST,
        session_token=SecretStr("synthetic-migration-token"),
        data_dir=tmp_path,
        enable_api_docs=False,
    )
    settings.prepare_directories()
    engine = create_engine(settings.sync_database_url)

    Project.__table__.create(engine)
    timestamp = datetime.now(UTC)
    with engine.begin() as connection:
        connection.execute(
            Project.__table__.insert().values(
                id="00000000-0000-0000-0000-000000000001",
                name="Interrupted migration project",
                project_number="SYNTHETIC-001",
                status="active",
                created_at=timestamp,
                updated_at=timestamp,
            )
        )

    run_migrations(settings)

    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())
        revision = connection.scalar(text("SELECT version_num FROM alembic_version"))
        preserved_name = connection.scalar(
            text("SELECT name FROM projects WHERE project_number = 'SYNTHETIC-001'")
        )

    assert {
        "alembic_version",
        "application_settings",
        "audit_events",
        "project_settings",
        "projects",
    }.issubset(tables)
    assert revision == "20260801_0002"
    assert preserved_name == "Interrupted migration project"
