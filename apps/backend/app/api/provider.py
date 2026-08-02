from __future__ import annotations

import asyncio

from fastapi import APIRouter, Request, Response, status
from sqlalchemy import select

from app.api.dependencies import SessionDep
from app.models.settings import ApplicationSettings
from app.schemas.knowledge import (
    ProviderKeyUpdate,
    ProviderStatus,
    ProviderTestResult,
)
from app.services.provider import ProviderClient
from app.services.settings import ApplicationSettingsService

router = APIRouter(prefix="/api/provider", tags=["provider"])
client = ProviderClient()
settings_service = ApplicationSettingsService()


async def _settings(session: SessionDep) -> ApplicationSettings:
    settings = await session.scalar(select(ApplicationSettings).where(ApplicationSettings.id == 1))
    if settings is None:
        await settings_service.get(session)
        settings = await session.scalar(
            select(ApplicationSettings).where(ApplicationSettings.id == 1)
        )
    assert settings is not None
    return settings


def _status(settings: ApplicationSettings, configured: bool) -> ProviderStatus:
    return ProviderStatus(
        configured=configured,
        provider=settings.ai_provider,
        base_url=settings.ai_base_url,
        model=settings.ai_model,
        external_ai_enabled=settings.external_ai_enabled,
    )


@router.get("", response_model=ProviderStatus)
async def provider_status(request: Request, session: SessionDep) -> ProviderStatus:
    settings = await _settings(session)
    return _status(settings, request.app.state.secret_store.configured())


@router.put("/key", response_model=ProviderStatus)
async def save_provider_key(
    payload: ProviderKeyUpdate,
    request: Request,
    session: SessionDep,
) -> ProviderStatus:
    await asyncio.to_thread(request.app.state.secret_store.set, payload.api_key)
    settings = await _settings(session)
    return _status(settings, True)


@router.delete("/key", status_code=status.HTTP_204_NO_CONTENT)
async def remove_provider_key(request: Request) -> Response:
    await asyncio.to_thread(request.app.state.secret_store.remove)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test", response_model=ProviderTestResult)
async def test_provider(
    request: Request,
    session: SessionDep,
) -> ProviderTestResult:
    settings = await _settings(session)
    api_key = await asyncio.to_thread(request.app.state.secret_store.get)
    if not api_key:
        from app.core.errors import ConfigurationError

        raise ConfigurationError(
            "Save an AI provider API key before testing the connection.",
            code="provider_key_required",
        )
    message = await client.test_connection(settings, api_key)
    return ProviderTestResult(success=True, message=message, model=settings.ai_model)
