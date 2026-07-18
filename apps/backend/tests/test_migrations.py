from __future__ import annotations

from fastapi import FastAPI
from sqlalchemy import inspect


async def test_foundation_migration_created_expected_tables(app: FastAPI) -> None:
    database = app.state.database
    async with database.engine.connect() as connection:
        tables = await connection.run_sync(
            lambda sync_connection: inspect(sync_connection).get_table_names()
        )

    assert {
        "alembic_version",
        "application_settings",
        "audit_events",
        "project_settings",
        "projects",
    }.issubset(set(tables))
