from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditEvent


def record_audit(
    session: AsyncSession,
    *,
    action: str,
    target_type: str,
    target_id: str,
    details: dict[str, object] | None = None,
) -> None:
    session.add(
        AuditEvent(
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details or {},
        )
    )
