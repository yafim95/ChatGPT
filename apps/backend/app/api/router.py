from fastapi import APIRouter

from app.api import health, projects, settings

router = APIRouter()
router.include_router(health.router)
router.include_router(projects.router)
router.include_router(settings.router)
