from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConflictError, NotFoundError
from app.models.project import Project, ProjectSettings
from app.schemas.common import Page
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.audit import record_audit


class ProjectService:
    @staticmethod
    async def _active_project(session: AsyncSession, project_id: str) -> Project:
        statement = (
            select(Project)
            .options(selectinload(Project.settings))
            .where(Project.id == project_id, Project.deleted_at.is_(None))
        )
        project = await session.scalar(statement)
        if project is None:
            raise NotFoundError("Project")
        return project

    async def create(self, session: AsyncSession, payload: ProjectCreate) -> ProjectRead:
        project = Project(
            name=payload.name,
            project_number=payload.project_number,
            client=payload.client,
            consultant=payload.consultant,
            contractor=payload.contractor,
            description=payload.description,
        )
        project.settings = ProjectSettings(**payload.settings.model_dump())
        session.add(project)
        try:
            await session.flush()
            record_audit(
                session,
                action="project.created",
                target_type="project",
                target_id=project.id,
            )
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise ConflictError("A project with this project number already exists.") from exc
        created = await self._active_project(session, project.id)
        return ProjectRead.model_validate(created)

    async def list(
        self,
        session: AsyncSession,
        *,
        limit: int,
        offset: int,
    ) -> Page[ProjectRead]:
        filters = (Project.deleted_at.is_(None),)
        total = await session.scalar(select(func.count(Project.id)).where(*filters))
        statement = (
            select(Project)
            .options(selectinload(Project.settings))
            .where(*filters)
            .order_by(Project.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        projects = list((await session.scalars(statement)).all())
        return Page[ProjectRead](
            items=[ProjectRead.model_validate(project) for project in projects],
            total=total or 0,
            limit=limit,
            offset=offset,
        )

    async def get(self, session: AsyncSession, project_id: str) -> ProjectRead:
        project = await self._active_project(session, project_id)
        return ProjectRead.model_validate(project)

    async def update(
        self,
        session: AsyncSession,
        project_id: str,
        payload: ProjectUpdate,
    ) -> ProjectRead:
        project = await self._active_project(session, project_id)
        changes = payload.model_dump(exclude_unset=True)
        for field, value in changes.items():
            setattr(project, field, value)
        record_audit(
            session,
            action="project.updated",
            target_type="project",
            target_id=project.id,
            details={"fields": sorted(changes)},
        )
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise ConflictError("A project with this project number already exists.") from exc
        updated = await self._active_project(session, project_id)
        return ProjectRead.model_validate(updated)

    async def archive(self, session: AsyncSession, project_id: str) -> None:
        project = await self._active_project(session, project_id)
        project.status = "archived"
        project.deleted_at = datetime.now(UTC)
        record_audit(
            session,
            action="project.archived",
            target_type="project",
            target_id=project.id,
        )
        await session.commit()
