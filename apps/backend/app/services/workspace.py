from __future__ import annotations

import csv
import fnmatch
import io
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConfigurationError, NotFoundError
from app.models.knowledge import (
    ChatMessage,
    CommentReplySheet,
    Conversation,
    ConversationDocument,
    CrsItem,
    Document,
    ReviewRecord,
)
from app.models.project import Project
from app.models.settings import ApplicationSettings
from app.schemas.knowledge import DocumentRead
from app.schemas.workspace import (
    CrsCreate,
    CrsItemCreate,
    CrsItemRead,
    CrsItemUpdate,
    CrsRead,
    CrsUpdate,
    DirectoryBreadcrumb,
    DirectoryListing,
    DocumentRelationships,
    DocumentWorkflowUpdate,
    ProjectFileEntry,
    RelatedConversation,
    RelatedCrs,
    RelatedReview,
)
from app.services.audit import record_audit
from app.services.documents import IGNORED_DIRECTORY_NAMES, DocumentService, _document_read
from app.services.extraction import SUPPORTED_EXTENSIONS

MAX_BROWSE_RESULTS = 1000


class WorkspaceService:
    @staticmethod
    async def _project(session: AsyncSession, project_id: str) -> Project:
        project = await session.scalar(
            select(Project)
            .options(selectinload(Project.settings))
            .where(Project.id == project_id, Project.deleted_at.is_(None))
        )
        if project is None:
            raise NotFoundError("Project")
        return project

    @staticmethod
    async def _settings(session: AsyncSession) -> ApplicationSettings:
        settings = await session.scalar(
            select(ApplicationSettings).where(ApplicationSettings.id == 1)
        )
        if settings is None:
            settings = ApplicationSettings(id=1)
            session.add(settings)
            await session.flush()
        return settings

    @staticmethod
    def _resolve_path(root: Path, relative_path: str) -> Path:
        normalized = relative_path.replace("\\", "/").strip("/")
        try:
            candidate = (root / Path(normalized)).resolve(strict=True) if normalized else root
        except OSError as exc:
            raise ConfigurationError(
                "The requested project path is unavailable.",
                code="workspace_path_unavailable",
            ) from exc
        try:
            candidate.relative_to(root)
        except ValueError as exc:
            raise ConfigurationError(
                "The requested path is outside the configured project folder.",
                code="invalid_workspace_path",
            ) from exc
        return candidate

    @staticmethod
    def _is_excluded(
        relative: Path,
        patterns: list[str],
        *,
        show_hidden: bool,
    ) -> bool:
        for part in relative.parts:
            folded = part.casefold()
            if folded in IGNORED_DIRECTORY_NAMES:
                return True
            if not show_hidden and part.startswith("."):
                return True
            if any(
                fnmatch.fnmatch(part, pattern) or fnmatch.fnmatch(relative.as_posix(), pattern)
                for pattern in patterns
            ):
                return True
        return False

    async def browse(
        self,
        session: AsyncSession,
        project_id: str,
        *,
        relative_path: str,
        query: str | None,
    ) -> DirectoryListing:
        project = await self._project(session, project_id)
        settings = await self._settings(session)
        root = DocumentService._workspace(project)
        current = self._resolve_path(root, relative_path)
        if not current.is_dir():
            raise ConfigurationError(
                "The requested project path is not a folder.",
                code="workspace_path_not_directory",
            )
        search = (query or "").strip().casefold()
        candidates = root.rglob("*") if search else current.iterdir()
        discovered: list[tuple[Path, Path]] = []
        patterns = project.settings.excluded_patterns
        for candidate in candidates:
            try:
                resolved = candidate.resolve(strict=True)
                relative = resolved.relative_to(root)
            except (OSError, ValueError):
                continue
            if self._is_excluded(
                relative,
                patterns,
                show_hidden=settings.show_hidden_files,
            ):
                continue
            if (
                search
                and search not in candidate.name.casefold()
                and search not in str(relative).casefold()
            ):
                continue
            discovered.append((resolved, relative))
            if len(discovered) > MAX_BROWSE_RESULTS:
                break

        file_paths = [relative.as_posix() for path, relative in discovered if path.is_file()]
        indexed: dict[str, Document] = {}
        if file_paths:
            documents = list(
                (
                    await session.scalars(
                        select(Document).where(
                            Document.project_id == project_id,
                            Document.is_current.is_(True),
                        )
                    )
                ).all()
            )
            wanted = {path.casefold() for path in file_paths}
            indexed = {
                document.relative_path.casefold(): document
                for document in documents
                if document.relative_path.casefold() in wanted
            }
        document_ids = [document.id for document in indexed.values()]
        chat_counts, review_counts, crs_counts = await self._relationship_counts(
            session,
            document_ids,
        )

        items: list[ProjectFileEntry] = []
        for path, relative in discovered[:MAX_BROWSE_RESULTS]:
            try:
                stat = path.stat()
            except OSError:
                continue
            is_directory = path.is_dir()
            document = indexed.get(relative.as_posix().casefold())
            items.append(
                ProjectFileEntry(
                    name=path.name,
                    relative_path=relative.as_posix(),
                    absolute_path=str(path),
                    kind="directory" if is_directory else "file",
                    extension=None if is_directory else path.suffix.lower(),
                    size_bytes=None if is_directory else stat.st_size,
                    modified_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC),
                    supported=not is_directory and path.suffix.lower() in SUPPORTED_EXTENSIONS,
                    indexed_document_id=document.id if document else None,
                    extraction_status=document.extraction_status if document else None,
                    workflow_state=document.workflow_state if document else "unreviewed",
                    review_code=document.review_code if document else None,
                    is_core_memory=document.is_core_memory if document else False,
                    memory_category=document.memory_category if document else None,
                    related_chat_count=chat_counts.get(document.id, 0) if document else 0,
                    review_count=review_counts.get(document.id, 0) if document else 0,
                    crs_count=crs_counts.get(document.id, 0) if document else 0,
                )
            )
        items.sort(key=lambda item: (item.kind != "directory", item.name.casefold()))

        current_relative = current.relative_to(root).as_posix()
        current_relative = "" if current_relative == "." else current_relative
        breadcrumbs = [DirectoryBreadcrumb(label=root.name, relative_path="")]
        accumulated: list[str] = []
        for part in Path(current_relative).parts if current_relative else []:
            accumulated.append(part)
            breadcrumbs.append(
                DirectoryBreadcrumb(label=part, relative_path=Path(*accumulated).as_posix())
            )
        parent_path: str | None = None
        if current_relative:
            parent = Path(current_relative).parent.as_posix()
            parent_path = "" if parent == "." else parent
        return DirectoryListing(
            workspace_name=root.name,
            current_path=current_relative,
            parent_path=parent_path,
            breadcrumbs=breadcrumbs,
            items=items,
            total=len(items),
            truncated=len(discovered) > MAX_BROWSE_RESULTS,
            query=query.strip() if query else None,
        )

    @staticmethod
    async def _relationship_counts(
        session: AsyncSession,
        document_ids: list[str],
    ) -> tuple[dict[str, int], dict[str, int], dict[str, int]]:
        if not document_ids:
            return {}, {}, {}
        chats = {
            str(document_id): int(count)
            for document_id, count in (
                await session.execute(
                    select(
                        ConversationDocument.document_id,
                        func.count(ConversationDocument.conversation_id),
                    )
                    .where(ConversationDocument.document_id.in_(document_ids))
                    .group_by(ConversationDocument.document_id)
                )
            ).all()
        }
        reviews = {
            str(document_id): int(count)
            for document_id, count in (
                await session.execute(
                    select(ReviewRecord.document_id, func.count(ReviewRecord.id))
                    .where(ReviewRecord.document_id.in_(document_ids))
                    .group_by(ReviewRecord.document_id)
                )
            ).all()
            if document_id is not None
        }
        sheets = {
            str(document_id): int(count)
            for document_id, count in (
                await session.execute(
                    select(CommentReplySheet.document_id, func.count(CommentReplySheet.id))
                    .where(CommentReplySheet.document_id.in_(document_ids))
                    .group_by(CommentReplySheet.document_id)
                )
            ).all()
        }
        return chats, reviews, sheets

    async def update_document(
        self,
        session: AsyncSession,
        project_id: str,
        document_id: str,
        payload: DocumentWorkflowUpdate,
    ) -> DocumentRead:
        project = await self._project(session, project_id)
        document = await session.scalar(
            select(Document).where(
                Document.id == document_id,
                Document.project_id == project_id,
                Document.is_current.is_(True),
            )
        )
        if document is None:
            raise NotFoundError("Document")
        changes = payload.model_dump(exclude_unset=True)
        if payload.review_code is not None:
            valid_codes = {str(item.get("code", "")) for item in project.settings.review_codes}
            if payload.review_code not in valid_codes:
                raise ConfigurationError(
                    "Choose a review code configured for this project.",
                    code="invalid_review_code",
                )
        for field, value in changes.items():
            setattr(document, field, value)
        if not document.is_core_memory:
            document.memory_category = None
        elif not document.memory_category:
            document.memory_category = payload.memory_category or "Other"
        if payload.workflow_state == "closed":
            document.review_closed_at = datetime.now(UTC)
        elif payload.workflow_state in {"unreviewed", "under_review"}:
            document.review_closed_at = None
            if payload.workflow_state == "unreviewed":
                document.review_code = None
        record_audit(
            session,
            action="document.workflow_updated",
            target_type="document",
            target_id=document.id,
            details={"fields": sorted(changes)},
        )
        await session.commit()
        await session.refresh(document)
        counts = await self._relationship_counts(session, [document.id])
        return _document_read(
            document,
            project.settings.workspace_path,
            related_chat_count=counts[0].get(document.id, 0),
            review_count=counts[1].get(document.id, 0),
            crs_count=counts[2].get(document.id, 0),
        )

    async def relationships(
        self,
        session: AsyncSession,
        project_id: str,
        document_id: str,
    ) -> DocumentRelationships:
        await self._project(session, project_id)
        document = await session.scalar(
            select(Document).where(
                Document.id == document_id,
                Document.project_id == project_id,
            )
        )
        if document is None:
            raise NotFoundError("Document")
        revision_ids = list(
            await session.scalars(
                select(Document.id).where(
                    Document.project_id == project_id,
                    Document.revision_group_id == document.revision_group_id,
                )
            )
        )
        conversation_rows = (
            await session.execute(
                select(Conversation, ConversationDocument.relation_type)
                .join(
                    ConversationDocument,
                    ConversationDocument.conversation_id == Conversation.id,
                )
                .where(
                    Conversation.project_id == project_id,
                    ConversationDocument.document_id.in_(revision_ids),
                )
                .order_by(Conversation.updated_at.desc())
            )
        ).all()
        conversations: list[RelatedConversation] = []
        seen_conversations: set[str] = set()
        for conversation, relation_type in conversation_rows:
            if conversation.id in seen_conversations:
                continue
            seen_conversations.add(conversation.id)
            message_count = await session.scalar(
                select(func.count(ChatMessage.id)).where(
                    ChatMessage.conversation_id == conversation.id
                )
            )
            conversations.append(
                RelatedConversation(
                    id=conversation.id,
                    title=conversation.title,
                    mode=conversation.mode,
                    relation_type=relation_type,
                    updated_at=conversation.updated_at,
                    message_count=message_count or 0,
                )
            )
        reviews = list(
            await session.scalars(
                select(ReviewRecord)
                .where(
                    ReviewRecord.project_id == project_id,
                    ReviewRecord.document_id.in_(revision_ids),
                )
                .order_by(ReviewRecord.updated_at.desc())
            )
        )
        sheets = list(
            await session.scalars(
                select(CommentReplySheet)
                .options(selectinload(CommentReplySheet.items))
                .where(
                    CommentReplySheet.project_id == project_id,
                    CommentReplySheet.document_id.in_(revision_ids),
                )
                .order_by(CommentReplySheet.updated_at.desc())
            )
        )
        return DocumentRelationships(
            conversations=conversations,
            reviews=[
                RelatedReview(
                    id=review.id,
                    title=review.title,
                    review_type=review.review_type,
                    workflow_state=review.workflow_state,
                    decision_code=review.decision_code,
                    updated_at=review.updated_at,
                )
                for review in reviews
            ],
            crs_sheets=[
                RelatedCrs(
                    id=sheet.id,
                    title=sheet.title,
                    status=sheet.status,
                    open_item_count=sum(1 for item in sheet.items if item.status == "open"),
                    updated_at=sheet.updated_at,
                )
                for sheet in sheets
            ],
        )


class CrsService:
    @staticmethod
    async def _sheet(
        session: AsyncSession,
        project_id: str,
        sheet_id: str,
    ) -> CommentReplySheet:
        sheet = await session.scalar(
            select(CommentReplySheet)
            .options(selectinload(CommentReplySheet.items))
            .execution_options(populate_existing=True)
            .where(
                CommentReplySheet.id == sheet_id,
                CommentReplySheet.project_id == project_id,
            )
        )
        if sheet is None:
            raise NotFoundError("Comment reply sheet")
        return sheet

    @staticmethod
    async def _read(session: AsyncSession, sheet: CommentReplySheet) -> CrsRead:
        file_name = await session.scalar(
            select(Document.file_name).where(Document.id == sheet.document_id)
        )
        return CrsRead(
            id=sheet.id,
            project_id=sheet.project_id,
            document_id=sheet.document_id,
            review_id=sheet.review_id,
            document_file_name=file_name,
            title=sheet.title,
            reference_number=sheet.reference_number,
            revision=sheet.revision,
            status=sheet.status,
            items=[CrsItemRead.model_validate(item) for item in sheet.items],
            created_at=sheet.created_at,
            updated_at=sheet.updated_at,
        )

    async def create(
        self,
        session: AsyncSession,
        project_id: str,
        payload: CrsCreate,
    ) -> CrsRead:
        document = await session.scalar(
            select(Document).where(
                Document.id == payload.document_id,
                Document.project_id == project_id,
                Document.is_current.is_(True),
            )
        )
        if document is None:
            raise NotFoundError("Document")
        if payload.review_id:
            review = await session.scalar(
                select(ReviewRecord).where(
                    ReviewRecord.id == payload.review_id,
                    ReviewRecord.project_id == project_id,
                )
            )
            if review is None:
                raise NotFoundError("Review")
            if review.document_id and review.document_id != document.id:
                raise ConfigurationError(
                    "The review and Comment Reply Sheet must reference the same document.",
                    code="crs_review_document_mismatch",
                )
            existing_sheet = await session.scalar(
                select(CommentReplySheet.id).where(
                    CommentReplySheet.project_id == project_id,
                    CommentReplySheet.review_id == review.id,
                )
            )
            if existing_sheet:
                raise ConfigurationError(
                    "This review already has a Comment Reply Sheet.",
                    code="crs_already_exists",
                )
        sheet = CommentReplySheet(
            project_id=project_id,
            document_id=document.id,
            review_id=payload.review_id,
            title=payload.title,
            reference_number=payload.reference_number,
            revision=payload.revision,
            status="open",
        )
        session.add(sheet)
        if document.workflow_state == "unreviewed":
            document.workflow_state = "under_review"
        await session.flush()
        record_audit(
            session,
            action="crs.created",
            target_type="comment_reply_sheet",
            target_id=sheet.id,
        )
        await session.commit()
        return await self._read(session, await self._sheet(session, project_id, sheet.id))

    async def list(
        self,
        session: AsyncSession,
        project_id: str,
        *,
        document_id: str | None = None,
    ) -> list[CrsRead]:
        filters = [CommentReplySheet.project_id == project_id]
        if document_id:
            filters.append(CommentReplySheet.document_id == document_id)
        sheets = list(
            await session.scalars(
                select(CommentReplySheet)
                .options(selectinload(CommentReplySheet.items))
                .where(*filters)
                .order_by(CommentReplySheet.updated_at.desc())
            )
        )
        return [await self._read(session, sheet) for sheet in sheets]

    async def get(
        self,
        session: AsyncSession,
        project_id: str,
        sheet_id: str,
    ) -> CrsRead:
        return await self._read(session, await self._sheet(session, project_id, sheet_id))

    async def update(
        self,
        session: AsyncSession,
        project_id: str,
        sheet_id: str,
        payload: CrsUpdate,
    ) -> CrsRead:
        sheet = await self._sheet(session, project_id, sheet_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(sheet, field, value)
        record_audit(
            session,
            action="crs.updated",
            target_type="comment_reply_sheet",
            target_id=sheet.id,
            details={"fields": sorted(payload.model_fields_set)},
        )
        await session.commit()
        return await self._read(session, await self._sheet(session, project_id, sheet_id))

    async def add_item(
        self,
        session: AsyncSession,
        project_id: str,
        sheet_id: str,
        payload: CrsItemCreate,
    ) -> CrsRead:
        sheet = await self._sheet(session, project_id, sheet_id)
        next_number = max((item.item_number for item in sheet.items), default=0) + 1
        item = CrsItem(sheet_id=sheet.id, item_number=next_number, **payload.model_dump())
        session.add(item)
        sheet.status = "open"
        record_audit(
            session,
            action="crs.item_added",
            target_type="comment_reply_sheet",
            target_id=sheet.id,
            details={"item_number": next_number},
        )
        await session.commit()
        return await self._read(session, await self._sheet(session, project_id, sheet_id))

    async def update_item(
        self,
        session: AsyncSession,
        project_id: str,
        sheet_id: str,
        item_id: str,
        payload: CrsItemUpdate,
    ) -> CrsRead:
        sheet = await self._sheet(session, project_id, sheet_id)
        item = next((candidate for candidate in sheet.items if candidate.id == item_id), None)
        if item is None:
            raise NotFoundError("CRS comment")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        if sheet.items and all(candidate.status == "closed" for candidate in sheet.items):
            sheet.status = "closed"
        elif any(candidate.status == "open" for candidate in sheet.items):
            sheet.status = "open"
        record_audit(
            session,
            action="crs.item_updated",
            target_type="crs_item",
            target_id=item.id,
            details={"fields": sorted(payload.model_fields_set)},
        )
        await session.commit()
        return await self._read(session, await self._sheet(session, project_id, sheet_id))

    async def delete_item(
        self,
        session: AsyncSession,
        project_id: str,
        sheet_id: str,
        item_id: str,
    ) -> None:
        sheet = await self._sheet(session, project_id, sheet_id)
        item = next((candidate for candidate in sheet.items if candidate.id == item_id), None)
        if item is None:
            raise NotFoundError("CRS comment")
        remaining = [candidate for candidate in sheet.items if candidate.id != item_id]
        await session.delete(item)
        sheet.status = (
            "closed"
            if remaining and all(candidate.status == "closed" for candidate in remaining)
            else "open"
        )
        record_audit(
            session,
            action="crs.item_deleted",
            target_type="crs_item",
            target_id=item.id,
        )
        await session.commit()

    async def export_csv(
        self,
        session: AsyncSession,
        project_id: str,
        sheet_id: str,
    ) -> str:
        sheet = await self._sheet(session, project_id, sheet_id)
        stream = io.StringIO(newline="")
        writer = csv.writer(stream)
        writer.writerow(
            [
                "Item",
                "Location / Clause",
                "Consultant Comment",
                "Contractor Reply",
                "Consultant Response",
                "Status",
            ]
        )
        for item in sheet.items:
            writer.writerow(
                [
                    item.item_number,
                    item.location or "",
                    item.consultant_comment,
                    item.contractor_reply or "",
                    item.consultant_response or "",
                    item.status,
                ]
            )
        return stream.getvalue()
