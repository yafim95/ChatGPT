from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Request
from sqlalchemy import text

from app.api.dependencies import SessionDep
from app.core.config import AppConfig
from app.schemas.health import HealthResponse, LiveResponse

router = APIRouter(tags=["health"])


@router.get("/health/live", response_model=LiveResponse, include_in_schema=False)
async def liveness() -> LiveResponse:
    return LiveResponse(status="alive")


@router.get("/api/health", response_model=HealthResponse)
async def health(
    request: Request,
    session: SessionDep,
) -> HealthResponse:
    await session.execute(text("SELECT 1"))
    settings: AppConfig = request.app.state.settings
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        database="ok",
        environment=settings.environment.value,
        timestamp=datetime.now(UTC),
    )
