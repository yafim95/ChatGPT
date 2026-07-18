from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import ApplicationSettings
from app.schemas.settings import ApplicationSettingsRead, ApplicationSettingsUpdate
from app.services.audit import record_audit


class ApplicationSettingsService:
    @staticmethod
    async def _get_or_create(session: AsyncSession) -> ApplicationSettings:
        settings = await session.scalar(
            select(ApplicationSettings).where(ApplicationSettings.id == 1)
        )
        if settings is None:
            settings = ApplicationSettings(id=1)
            session.add(settings)
            await session.commit()
            await session.refresh(settings)
        return settings

    async def get(self, session: AsyncSession) -> ApplicationSettingsRead:
        settings = await self._get_or_create(session)
        return ApplicationSettingsRead.model_validate(settings)

    async def update(
        self,
        session: AsyncSession,
        payload: ApplicationSettingsUpdate,
    ) -> ApplicationSettingsRead:
        settings = await self._get_or_create(session)
        changes = payload.model_dump(exclude_unset=True, exclude_none=True)
        for field, value in changes.items():
            setattr(settings, field, value)
        record_audit(
            session,
            action="application_settings.updated",
            target_type="application_settings",
            target_id="1",
            details={"fields": sorted(changes)},
        )
        await session.commit()
        await session.refresh(settings)
        return ApplicationSettingsRead.model_validate(settings)
