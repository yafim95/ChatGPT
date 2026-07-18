from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import SessionDep
from app.schemas.settings import ApplicationSettingsRead, ApplicationSettingsUpdate
from app.services.settings import ApplicationSettingsService

router = APIRouter(prefix="/api/settings", tags=["settings"])
service = ApplicationSettingsService()


@router.get("", response_model=ApplicationSettingsRead)
async def get_application_settings(
    session: SessionDep,
) -> ApplicationSettingsRead:
    return await service.get(session)


@router.patch("", response_model=ApplicationSettingsRead)
async def update_application_settings(
    payload: ApplicationSettingsUpdate,
    session: SessionDep,
) -> ApplicationSettingsRead:
    return await service.update(session, payload)
