"""Import target for Alembic metadata discovery."""

from app.models.audit import AuditEvent
from app.models.base import Base
from app.models.knowledge import ChatMessage, Conversation, Document, ReviewRecord
from app.models.project import Project, ProjectSettings
from app.models.settings import ApplicationSettings

__all__ = [
    "ApplicationSettings",
    "AuditEvent",
    "Base",
    "ChatMessage",
    "Conversation",
    "Document",
    "Project",
    "ProjectSettings",
    "ReviewRecord",
]
