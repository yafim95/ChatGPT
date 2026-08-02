from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConfigurationError, NotFoundError
from app.core.secrets import SecretStore
from app.models.knowledge import CommentReplySheet, Document, ReviewRecord
from app.models.project import Project
from app.schemas.knowledge import ChatRequest, ReviewCreate, ReviewRead, ReviewUpdate
from app.services.audit import record_audit
from app.services.chat import ChatService

REVIEW_LABELS = {
    "material_submittal": "material submittal",
    "method_statement": "method statement and risk assessment",
    "itp": "inspection and test plan",
    "shop_drawing": "shop drawing",
    "technical_report": "technical report",
    "general": "engineering document",
}


class ReviewService:
    def __init__(self) -> None:
        self._chat = ChatService()

    async def create(
        self,
        session: AsyncSession,
        project_id: str,
        payload: ReviewCreate,
        secret_store: SecretStore,
    ) -> ReviewRead:
        project = await session.scalar(
            select(Project)
            .options(selectinload(Project.settings))
            .where(Project.id == project_id, Project.deleted_at.is_(None))
        )
        if project is None:
            raise NotFoundError("Project")
        document: Document | None = None
        if payload.document_id:
            document = await session.scalar(
                select(Document).where(
                    Document.id == payload.document_id,
                    Document.project_id == project_id,
                    Document.is_current.is_(True),
                )
            )
            if document is None:
                raise NotFoundError("Document")
        valid_codes = {str(item.get("code", "")) for item in project.settings.review_codes}
        if payload.decision_code and payload.decision_code not in valid_codes:
            raise ConfigurationError(
                "Choose a review code configured for this project.",
                code="invalid_review_code",
            )

        result = ""
        sources: list[dict[str, object]] = []
        conversation_id: str | None = None
        if payload.generate_with_ai:
            review_label = REVIEW_LABELS[payload.review_type]
            prompt = (
                f"Review this {review_label} against the indexed project requirements. "
                "Provide only material, actionable comments. For every project-specific comment, "
                "cite the supporting source reference. Identify missing evidence and conflicts; do "
                "not assume compliance. Use concise numbered comments suitable for a consultant "
                "comment reply sheet.\n\n"
                f"Review instructions:\n{payload.instructions}"
            )
            response = await self._chat.ask(
                session,
                project_id,
                ChatRequest(
                    message=prompt,
                    mode="evidence",
                    document_ids=[document.id] if document else [],
                    include_core_memory=True,
                    conversation_title=f"Review · {payload.title}",
                ),
                secret_store,
                persist=True,
            )
            result = response.message
            sources = [source.model_dump(mode="json") for source in response.sources]
            conversation_id = response.conversation_id

        due_at = payload.due_at or datetime.now(UTC) + timedelta(
            days=project.settings.default_review_due_days
        )
        review = ReviewRecord(
            project_id=project_id,
            document_id=document.id if document else None,
            conversation_id=conversation_id,
            title=payload.title,
            review_type=payload.review_type,
            reference_number=payload.reference_number,
            discipline=payload.discipline,
            instructions=payload.instructions,
            result=result,
            sources=sources,
            status="draft",
            workflow_state="open",
            decision_code=payload.decision_code,
            due_at=due_at,
        )
        session.add(review)
        await session.flush()
        if document:
            document.workflow_state = "under_review"
            document.review_code = payload.decision_code
            document.review_closed_at = None
        if document and payload.create_crs:
            session.add(
                CommentReplySheet(
                    project_id=project_id,
                    document_id=document.id,
                    review_id=review.id,
                    title=f"CRS · {payload.title}",
                    reference_number=payload.reference_number,
                    revision=None,
                    status="open",
                )
            )
        record_audit(
            session,
            action="review.created",
            target_type="review",
            target_id=review.id,
            details={
                "review_type": payload.review_type,
                "source_count": len(sources),
                "document_id": document.id if document else None,
            },
        )
        await session.commit()
        await session.refresh(review)
        return await self._read(session, review)

    @staticmethod
    async def list(session: AsyncSession, project_id: str) -> list[ReviewRead]:
        reviews = list(
            (
                await session.scalars(
                    select(ReviewRecord)
                    .options(selectinload(ReviewRecord.crs_sheets))
                    .where(ReviewRecord.project_id == project_id)
                    .order_by(ReviewRecord.updated_at.desc())
                    .limit(100)
                )
            ).all()
        )
        return [await ReviewService._read(session, review) for review in reviews]

    @staticmethod
    async def get(
        session: AsyncSession,
        project_id: str,
        review_id: str,
    ) -> ReviewRead:
        review = await session.scalar(
            select(ReviewRecord)
            .options(selectinload(ReviewRecord.crs_sheets))
            .where(
                ReviewRecord.id == review_id,
                ReviewRecord.project_id == project_id,
            )
        )
        if review is None:
            raise NotFoundError("Review")
        return await ReviewService._read(session, review)

    @staticmethod
    async def update(
        session: AsyncSession,
        project_id: str,
        review_id: str,
        payload: ReviewUpdate,
    ) -> ReviewRead:
        review = await session.scalar(
            select(ReviewRecord)
            .options(selectinload(ReviewRecord.crs_sheets))
            .where(
                ReviewRecord.id == review_id,
                ReviewRecord.project_id == project_id,
            )
        )
        if review is None:
            raise NotFoundError("Review")
        if payload.decision_code is not None:
            project = await session.scalar(
                select(Project)
                .options(selectinload(Project.settings))
                .where(Project.id == project_id, Project.deleted_at.is_(None))
            )
            if project is None:
                raise NotFoundError("Project")
            valid_codes = {str(item.get("code", "")) for item in project.settings.review_codes}
            if payload.decision_code not in valid_codes:
                raise ConfigurationError(
                    "Choose a review code configured for this project.",
                    code="invalid_review_code",
                )
        changes = payload.model_dump(exclude_unset=True)
        for field, value in changes.items():
            setattr(review, field, value)
        document: Document | None = None
        if review.document_id:
            document = await session.scalar(
                select(Document).where(Document.id == review.document_id)
            )
        if payload.workflow_state == "closed":
            review.closed_at = datetime.now(UTC)
            if document:
                document.workflow_state = "closed"
                document.review_code = review.decision_code
                document.review_closed_at = review.closed_at
        elif payload.workflow_state == "open":
            review.closed_at = None
            if document:
                document.workflow_state = "under_review"
                document.review_closed_at = None
        if "decision_code" in payload.model_fields_set and document:
            document.review_code = review.decision_code
        record_audit(
            session,
            action="review.updated",
            target_type="review",
            target_id=review.id,
            details={"fields": sorted(changes)},
        )
        await session.commit()
        refreshed = await session.scalar(
            select(ReviewRecord)
            .options(selectinload(ReviewRecord.crs_sheets))
            .where(ReviewRecord.id == review.id)
        )
        assert refreshed is not None
        return await ReviewService._read(session, refreshed)

    @staticmethod
    async def _read(session: AsyncSession, review: ReviewRecord) -> ReviewRead:
        file_name = None
        if review.document_id:
            file_name = await session.scalar(
                select(Document.file_name).where(Document.id == review.document_id)
            )
        return ReviewRead(
            id=review.id,
            project_id=review.project_id,
            document_id=review.document_id,
            document_file_name=file_name,
            conversation_id=review.conversation_id,
            title=review.title,
            review_type=review.review_type,
            reference_number=review.reference_number,
            discipline=review.discipline,
            instructions=review.instructions,
            result=review.result,
            sources=review.sources,
            status=review.status,
            workflow_state=review.workflow_state,
            decision_code=review.decision_code,
            due_at=review.due_at,
            closed_at=review.closed_at,
            crs_ids=[sheet.id for sheet in review.crs_sheets],
            created_at=review.created_at,
            updated_at=review.updated_at,
        )
