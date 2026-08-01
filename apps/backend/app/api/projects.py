from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query, Response, status

from app.api.dependencies import SessionDep
from app.schemas.common import Page
from app.schemas.project import ProjectCreate, ProjectRead, ProjectSettingsUpdate, ProjectUpdate
from app.services.projects import ProjectService

router = APIRouter(prefix="/api/projects", tags=["projects"])
service = ProjectService()


@router.get("", response_model=Page[ProjectRead])
async def list_projects(
    session: SessionDep,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status_filter: Literal["active", "archived", "all"] = Query(
        default="active",
        alias="status",
    ),
) -> Page[ProjectRead]:
    return await service.list(
        session,
        limit=limit,
        offset=offset,
        status=status_filter,
    )


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    session: SessionDep,
) -> ProjectRead:
    return await service.create(session, payload)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: str,
    session: SessionDep,
) -> ProjectRead:
    return await service.get(session, project_id)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    session: SessionDep,
) -> ProjectRead:
    return await service.update(session, project_id, payload)


@router.patch("/{project_id}/settings", response_model=ProjectRead)
async def update_project_settings(
    project_id: str,
    payload: ProjectSettingsUpdate,
    session: SessionDep,
) -> ProjectRead:
    return await service.update_settings(session, project_id, payload)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_project(
    project_id: str,
    session: SessionDep,
) -> Response:
    await service.archive(session, project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/restore", response_model=ProjectRead)
async def restore_project(
    project_id: str,
    session: SessionDep,
) -> ProjectRead:
    return await service.restore(session, project_id)
