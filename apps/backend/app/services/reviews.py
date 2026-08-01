from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.core.secrets import SecretStore
from app.models.knowledge import ReviewRecord
from app.schemas.knowledge import ChatRequest, ReviewCreate, ReviewRead
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
        review_label = REVIEW_LABELS[payload.review_type]
        prompt = (
            f"Review this {review_label} against the indexed project requirements. "
            "Provide only material, actionable comments. For every project-specific comment, "
            "cite the supporting source reference. Identify missing evidence and conflicts; do "
            "not assume compliance. Use concise numbered comments.\n\n"
            f"Review instructions:\n{payload.instructions}"
        )
        response = await self._chat.ask(
            session,
            project_id,
            ChatRequest(message=prompt, mode="evidence"),
            secret_store,
            persist=False,
        )
        review = ReviewRecord(
            project_id=project_id,
            title=payload.title,
            review_type=payload.review_type,
            instructions=payload.instructions,
            result=response.message,
            sources=[source.model_dump(mode="json") for source in response.sources],
            status="draft",
        )
        session.add(review)
        await session.flush()
        record_audit(
            session,
            action="review.created",
            target_type="review",
            target_id=review.id,
            details={"review_type": payload.review_type, "source_count": len(response.sources)},
        )
        await session.commit()
        await session.refresh(review)
        return ReviewRead.model_validate(review)

    @staticmethod
    async def list(session: AsyncSession, project_id: str) -> list[ReviewRead]:
        reviews = list(
            (
                await session.scalars(
                    select(ReviewRecord)
                    .where(ReviewRecord.project_id == project_id)
                    .order_by(ReviewRecord.updated_at.desc())
                    .limit(100)
                )
            ).all()
        )
        return [ReviewRead.model_validate(review) for review in reviews]

    @staticmethod
    async def get(
        session: AsyncSession,
        project_id: str,
        review_id: str,
    ) -> ReviewRead:
        review = await session.scalar(
            select(ReviewRecord).where(
                ReviewRecord.id == review_id,
                ReviewRecord.project_id == project_id,
            )
        )
        if review is None:
            raise NotFoundError("Review")
        return ReviewRead.model_validate(review)
