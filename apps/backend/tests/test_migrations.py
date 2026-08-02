from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from app.core.config import AppConfig, Environment
from app.database.migrations import run_migrations
from app.models.project import Project
from fastapi import FastAPI
from pydantic import SecretStr
from sqlalchemy import create_engine, inspect, text


def _alembic_config(settings: AppConfig) -> Config:
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    config.set_main_option("sqlalchemy.url", settings.sync_database_url.replace("%", "%%"))
    return config


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
        "comment_reply_sheets",
        "conversations",
        "conversation_documents",
        "crs_items",
        "document_chunk_search",
        "document_chunks",
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
    assert "Running upgrade 20260801_0002 -> 20260801_0003" in application_log


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
    assert revision == "20260801_0003"
    assert preserved_name == "Interrupted migration project"


def test_engineering_workspace_migration_preserves_v020_data(tmp_path: Path) -> None:
    settings = AppConfig(
        environment=Environment.TEST,
        session_token=SecretStr("synthetic-upgrade-token"),
        data_dir=tmp_path,
        enable_api_docs=False,
    )
    settings.prepare_directories()
    config = _alembic_config(settings)
    command.upgrade(config, "20260801_0002")

    timestamp = datetime.now(UTC).isoformat()
    old_review_codes = [
        {"code": "1", "label": "Approved"},
        {"code": "2", "label": "Approved with comments"},
        {"code": "3", "label": "Revise and resubmit"},
        {"code": "4", "label": "Rejected"},
    ]
    with sqlite3.connect(settings.database_path) as connection:
        connection.execute(
            "INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "project-v020",
                "Preserved project",
                "UPGRADE-020",
                None,
                None,
                None,
                "Existing v0.2 project",
                "active",
                None,
                timestamp,
                timestamp,
            ),
        )
        connection.execute(
            "INSERT INTO project_settings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "project-v020",
                "Asia/Dubai",
                "en-AE",
                json.dumps(["Civil"]),
                json.dumps(old_review_codes),
                json.dumps(["Contract", "Specifications"]),
                json.dumps(["Contract", "Specifications"]),
                str(tmp_path / "workspace"),
                1,
                1,
            ),
        )
        connection.execute(
            "INSERT INTO documents("
            "id, project_id, revision_group_id, relative_path, source_path, file_name, "
            "extension, mime_type, sha256, duplicate_of_id, size_bytes, source_modified_at, "
            "page_count, word_count, extracted_text, extraction_status, extraction_error, "
            "version_number, is_current, is_missing, created_at, updated_at"
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "document-v020",
                "project-v020",
                "revision-v020",
                "Contract.txt",
                str(tmp_path / "workspace" / "Contract.txt"),
                "Contract.txt",
                ".txt",
                "text/plain",
                "a" * 64,
                None,
                48,
                timestamp,
                None,
                8,
                "The completion period is 365 calendar days.",
                "ready",
                None,
                1,
                1,
                0,
                timestamp,
                timestamp,
            ),
        )

    command.upgrade(config, "head")

    with sqlite3.connect(settings.database_path) as connection:
        connection.row_factory = sqlite3.Row
        document = connection.execute(
            "SELECT is_core_memory, workflow_state FROM documents WHERE id = ?",
            ("document-v020",),
        ).fetchone()
        chunks = connection.execute(
            "SELECT COUNT(*) FROM document_chunks WHERE document_id = ?",
            ("document-v020",),
        ).fetchone()[0]
        codes = json.loads(
            connection.execute(
                "SELECT review_codes FROM project_settings WHERE project_id = ?",
                ("project-v020",),
            ).fetchone()[0]
        )
        revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()[0]

    assert document is not None
    assert document["is_core_memory"] == 0
    assert document["workflow_state"] == "unreviewed"
    assert chunks == 1
    assert [item["code"] for item in codes] == ["1", "2", "3"]
    assert revision == "20260801_0003"
