from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from app.core.config import AppConfig, Environment
from app.main import create_app
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

TEST_TOKEN = "test-session-token"  # noqa: S105 - synthetic test credential


@pytest.fixture
async def app(tmp_path: Path) -> AsyncIterator[FastAPI]:
    settings = AppConfig(
        environment=Environment.TEST,
        session_token=SecretStr(TEST_TOKEN),
        data_dir=tmp_path,
        enable_api_docs=False,
    )
    application = create_app(settings)
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={"X-ProjectMind-Session": TEST_TOKEN},
    ) as test_client:
        yield test_client
