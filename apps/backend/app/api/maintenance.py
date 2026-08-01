from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.dependencies import SessionDep
from app.schemas.knowledge import BackupRead, DashboardSummary, MaintenanceInfo
from app.services.maintenance import DashboardService, MaintenanceService

router = APIRouter(prefix="/api", tags=["maintenance"])
maintenance = MaintenanceService()


@router.get("/dashboard", response_model=DashboardSummary)
async def dashboard(request: Request, session: SessionDep) -> DashboardSummary:
    return await DashboardService.summary(session, request.app.state.secret_store)


@router.get("/maintenance", response_model=MaintenanceInfo)
async def maintenance_info(request: Request) -> MaintenanceInfo:
    return maintenance.info(request.app.state.settings)


@router.post("/maintenance/backup", response_model=BackupRead)
async def create_backup(request: Request, session: SessionDep) -> BackupRead:
    return await maintenance.create_backup(session, request.app.state.settings)
