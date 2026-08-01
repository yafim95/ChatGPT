from fastapi import APIRouter

from app.api import health, knowledge, maintenance, projects, provider, settings

router = APIRouter()
router.include_router(health.router)
router.include_router(projects.router)
router.include_router(settings.router)
router.include_router(knowledge.router)
router.include_router(provider.router)
router.include_router(maintenance.router)
