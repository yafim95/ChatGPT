from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.dependencies import SessionDep
from app.core.logging import set_diagnostic_logging_enabled
from app.schemas.settings import ApplicationSettingsRead, ApplicationSettingsUpdate
from app.services.settings import ApplicationSettingsService

router = APIRouter(prefix="/api/settings", tags=["settings"])
service = ApplicationSettingsService()


@router.get("", response_model=ApplicationSettingsRead)
async def get_application_settings(
    request: Request,
    session: SessionDep,
) -> ApplicationSettingsRead:
    return await service.get(
        session,
        api_key_configured=request.app.state.secret_store.configured(),
    )


@router.patch("", response_model=ApplicationSettingsRead)
async def update_application_settings(
    payload: ApplicationSettingsUpdate,
    request: Request,
    session: SessionDep,
) -> ApplicationSettingsRead:
    updated = await service.update(session, payload)
    if payload.diagnostic_logging_enabled is not None:
        set_diagnostic_logging_enabled(payload.diagnostic_logging_enabled)
    return updated.model_copy(
        update={"ai_api_key_configured": request.app.state.secret_store.configured()}
    )
