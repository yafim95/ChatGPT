from __future__ import annotations

import asyncio
import hashlib
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import ClassVar
from uuid import uuid4

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ConfigurationError, NotFoundError
from app.models.knowledge import Conversation, Document, ReviewRecord
from app.models.project import Project
from app.schemas.knowledge import (
    DocumentPage,
    DocumentPreview,
    DocumentRead,
    ProjectSummary,
    ScanSummary,
    SearchResponse,
    SearchResult,
)
from app.services.audit import record_audit
from app.services.extraction import SUPPORTED_EXTENSIONS, extract_document

IGNORED_DIRECTORY_NAMES = {
    ".git",
    ".idea",
    ".projectmind",
    ".venv",
    "__pycache__",
    "node_modules",
    "target",
}
MAX_DISCOVERED_FILES = 20_000
MAX_FILE_BYTES = 150 * 1024 * 1024
PREVIEW_CHARACTER_LIMIT = 80_000
SEARCH_STOP_WORDS = {
    "a",
    "about",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "can",
    "do",
    "does",
    "for",
    "from",
    "give",
    "how",
    "in",
    "is",
    "it",
    "me",
    "of",
    "on",
    "or",
    "please",
    "show",
    "tell",
    "that",
    "the",
    "these",
    "this",
    "those",
    "to",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "عن",
    "في",
    "ما",
    "من",
    "هو",
    "هي",
}


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _absolute_path(workspace_path: str | None, relative_path: str) -> str:
    if not workspace_path:
        return relative_path
    return str(Path(workspace_path) / Path(relative_path))


def _document_read(document: Document, workspace_path: str | None) -> DocumentRead:
    return DocumentRead(
        id=document.id,
        project_id=document.project_id,
        revision_group_id=document.revision_group_id,
        relative_path=document.relative_path,
        absolute_path=document.source_path
        or _absolute_path(workspace_path, document.relative_path),
        file_name=document.file_name,
        extension=document.extension,
        mime_type=document.mime_type,
        sha256=document.sha256,
        duplicate_of_id=document.duplicate_of_id,
        size_bytes=document.size_bytes,
        source_modified_at=document.source_modified_at,
        page_count=document.page_count,
        word_count=document.word_count,
        extraction_status=document.extraction_status,
        extraction_error=document.extraction_error,
        version_number=document.version_number,
        is_current=document.is_current,
        is_missing=document.is_missing,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


class DocumentService:
    _scan_locks: ClassVar[dict[str, asyncio.Lock]] = {}

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
    def _workspace(project: Project) -> Path:
        configured = project.settings.workspace_path
        if not configured:
            raise ConfigurationError(
                "Choose a project folder before scanning documents.",
                code="workspace_required",
            )
        try:
            root = Path(configured).expanduser().resolve(strict=True)
        except OSError as exc:
            raise ConfigurationError(
                "The selected project folder is unavailable. Choose an existing folder.",
                code="workspace_unavailable",
            ) from exc
        if not root.is_dir():
            raise ConfigurationError(
                "The selected project workspace is not a folder.",
                code="workspace_unavailable",
            )
        if root == Path(root.anchor):
            raise ConfigurationError(
                "Select a project-specific folder instead of an entire drive.",
                code="workspace_too_broad",
            )
        return root

    @staticmethod
    def _discover(root: Path, include_subfolders: bool) -> list[Path]:
        candidates = root.rglob("*") if include_subfolders else root.iterdir()
        files: list[Path] = []
        for candidate in candidates:
            try:
                relative = candidate.relative_to(root)
                resolved = candidate.resolve(strict=True)
                resolved.relative_to(root)
            except (OSError, ValueError):
                continue
            if any(
                part.casefold() in IGNORED_DIRECTORY_NAMES or part.startswith(".")
                for part in relative.parts
            ):
                continue
            if candidate.name.startswith("~$"):
                continue
            if candidate.is_file() and candidate.suffix.lower() in SUPPORTED_EXTENSIONS:
                files.append(candidate)
                if len(files) > MAX_DISCOVERED_FILES:
                    raise ConfigurationError(
                        f"The folder contains more than {MAX_DISCOVERED_FILES:,} supported files. "
                        "Choose a narrower project folder.",
                        code="workspace_too_large",
                    )
        return sorted(files, key=lambda path: str(path).casefold())

    async def list(
        self,
        session: AsyncSession,
        project_id: str,
        *,
        limit: int,
        offset: int,
        include_versions: bool,
        query: str | None,
    ) -> DocumentPage:
        project = await self._project(session, project_id)
        filters = [Document.project_id == project_id]
        if not include_versions:
            filters.append(Document.is_current.is_(True))
        if query:
            pattern = f"%{query.strip()}%"
            filters.append(
                Document.file_name.ilike(pattern) | Document.relative_path.ilike(pattern)
            )
        total = await session.scalar(select(func.count(Document.id)).where(*filters))
        statement = (
            select(Document)
            .where(*filters)
            .order_by(Document.updated_at.desc(), Document.file_name.asc())
            .limit(limit)
            .offset(offset)
        )
        documents = list((await session.scalars(statement)).all())
        return DocumentPage(
            items=[
                _document_read(document, project.settings.workspace_path) for document in documents
            ],
            total=total or 0,
            limit=limit,
            offset=offset,
        )

    async def preview(
        self,
        session: AsyncSession,
        project_id: str,
        document_id: str,
    ) -> DocumentPreview:
        project = await self._project(session, project_id)
        document = await session.scalar(
            select(Document).where(Document.id == document_id, Document.project_id == project_id)
        )
        if document is None:
            raise NotFoundError("Document")
        text_content = document.extracted_text[:PREVIEW_CHARACTER_LIMIT]
        return DocumentPreview(
            document=_document_read(document, project.settings.workspace_path),
            text=text_content,
            truncated=len(document.extracted_text) > PREVIEW_CHARACTER_LIMIT,
        )

    async def scan(self, session: AsyncSession, project_id: str) -> ScanSummary:
        lock = self._scan_locks.setdefault(project_id, asyncio.Lock())
        async with lock:
            return await self._scan_documents(session, project_id)

    async def _scan_documents(self, session: AsyncSession, project_id: str) -> ScanSummary:
        project = await self._project(session, project_id)
        root = self._workspace(project)
        files = await asyncio.to_thread(
            self._discover,
            root,
            project.settings.include_subfolders,
        )
        current_documents = list(
            (
                await session.scalars(
                    select(Document).where(
                        Document.project_id == project_id,
                        Document.is_current.is_(True),
                    )
                )
            ).all()
        )
        current_by_path = {
            document.relative_path.casefold(): document for document in current_documents
        }
        current_by_hash = {
            document.sha256: document
            for document in current_documents
            if document.extraction_status == "ready" and not document.is_missing
        }
        seen: set[str] = set()
        added = updated = unchanged = failed = 0

        for path in files:
            relative_path = path.relative_to(root).as_posix()
            key = relative_path.casefold()
            seen.add(key)
            existing = current_by_path.get(key)
            try:
                stat = await asyncio.to_thread(path.stat)
                file_hash = await asyncio.to_thread(_hash_file, path)
            except OSError as exc:
                failed += 1
                if existing is None:
                    error_marker = f"unreadable:{relative_path}:{type(exc).__name__}"
                    document = Document(
                        project_id=project_id,
                        revision_group_id=str(uuid4()),
                        relative_path=relative_path,
                        source_path=str(path),
                        file_name=path.name,
                        extension=path.suffix.lower(),
                        mime_type=None,
                        sha256=hashlib.sha256(error_marker.encode()).hexdigest(),
                        duplicate_of_id=None,
                        size_bytes=0,
                        source_modified_at=datetime.now(UTC),
                        page_count=None,
                        word_count=0,
                        extracted_text="",
                        extraction_status="failed",
                        extraction_error=(
                            f"The file could not be read ({type(exc).__name__}). "
                            "Check its permissions and try scanning again."
                        ),
                        version_number=1,
                        is_current=True,
                        is_missing=False,
                    )
                    session.add(document)
                    await session.flush()
                    current_by_path[key] = document
                    added += 1
                continue
            if stat.st_size > MAX_FILE_BYTES:
                extraction_error = f"File exceeds the {MAX_FILE_BYTES // (1024 * 1024)} MB limit."
                extraction = None
            else:
                extraction_error = None
                extraction = None

            if existing is not None and existing.sha256 == file_hash:
                existing.is_missing = False
                existing.source_path = str(path)
                existing.source_modified_at = datetime.fromtimestamp(stat.st_mtime, tz=UTC)
                unchanged += 1
                continue

            if extraction_error is None:
                try:
                    extraction = await asyncio.to_thread(extract_document, path)
                    if not extraction.text:
                        extraction_error = (
                            "No extractable text was found. The document may be image-only; "
                            "OCR is not enabled in this release."
                        )
                except Exception as exc:  # parser failures become visible per-file records
                    extraction_error = f"{type(exc).__name__}: {str(exc)[:450]}"

            if existing is None:
                revision_group_id = str(uuid4())
                version_number = 1
                added += 1
            else:
                existing.is_current = False
                revision_group_id = existing.revision_group_id
                version_number = existing.version_number + 1
                updated += 1

            duplicate = current_by_hash.get(file_hash)
            document = Document(
                project_id=project_id,
                revision_group_id=revision_group_id,
                relative_path=relative_path,
                source_path=str(path),
                file_name=path.name,
                extension=path.suffix.lower(),
                mime_type=extraction.mime_type if extraction else None,
                sha256=file_hash,
                duplicate_of_id=(
                    duplicate.id if duplicate and duplicate.relative_path != relative_path else None
                ),
                size_bytes=stat.st_size,
                source_modified_at=datetime.fromtimestamp(stat.st_mtime, tz=UTC),
                page_count=extraction.page_count if extraction else None,
                word_count=extraction.word_count if extraction else 0,
                extracted_text=extraction.text if extraction else "",
                extraction_status=(
                    "ready"
                    if extraction and extraction.text
                    else "no_text"
                    if extraction
                    else "failed"
                ),
                extraction_error=extraction_error,
                version_number=version_number,
                is_current=True,
                is_missing=False,
            )
            session.add(document)
            await session.flush()
            current_by_path[key] = document
            if extraction is not None and extraction.text:
                current_by_hash.setdefault(file_hash, document)
                await session.execute(
                    text(
                        "INSERT INTO document_search(document_id, project_id, title, content) "
                        "VALUES (:document_id, :project_id, :title, :content)"
                    ),
                    {
                        "document_id": document.id,
                        "project_id": project_id,
                        "title": document.file_name,
                        "content": document.extracted_text,
                    },
                )
            else:
                failed += 1

        missing = 0
        for document in current_documents:
            if document.relative_path.casefold() not in seen and not document.is_missing:
                document.is_missing = True
                missing += 1

        record_audit(
            session,
            action="documents.scanned",
            target_type="project",
            target_id=project_id,
            details={
                "discovered": len(files),
                "added": added,
                "updated": updated,
                "unchanged": unchanged,
                "failed": failed,
                "missing": missing,
            },
        )
        await session.commit()
        return ScanSummary(
            discovered=len(files),
            added=added,
            updated=updated,
            unchanged=unchanged,
            failed=failed,
            missing=missing,
            supported_extensions=list(SUPPORTED_EXTENSIONS),
            completed_at=datetime.now(UTC),
        )

    async def remove_from_index(
        self,
        session: AsyncSession,
        project_id: str,
        document_id: str,
    ) -> None:
        await self._project(session, project_id)
        document = await session.scalar(
            select(Document).where(
                Document.id == document_id,
                Document.project_id == project_id,
                Document.is_current.is_(True),
            )
        )
        if document is None:
            raise NotFoundError("Document")
        document.is_current = False
        document.extraction_status = "removed"
        await session.execute(
            text(
                "DELETE FROM document_search WHERE document_id IN ("
                "SELECT id FROM documents WHERE project_id = :project_id "
                "AND revision_group_id = :revision_group_id)"
            ),
            {
                "project_id": project_id,
                "revision_group_id": document.revision_group_id,
            },
        )
        record_audit(
            session,
            action="document.removed_from_index",
            target_type="document",
            target_id=document_id,
        )
        await session.commit()

    async def search(
        self,
        session: AsyncSession,
        project_id: str,
        query: str,
        *,
        limit: int,
        include_superseded: bool,
    ) -> SearchResponse:
        await self._project(session, project_id)
        raw_tokens = re.findall(r"[\w-]{2,}", query, flags=re.UNICODE)[:24]
        tokens = [token for token in raw_tokens if token.casefold() not in SEARCH_STOP_WORDS][:16]
        if not tokens:
            tokens = raw_tokens[:8]
        if not tokens:
            return SearchResponse(query=query, results=[], total=0)
        match_expression = " AND ".join(f'"{token}"*' for token in tokens)
        base_query = (
            "SELECT d.id AS document_id, d.sha256, d.file_name, d.relative_path, "
            "d.version_number, "
            "snippet(document_search, 3, '', '', ' … ', 64) AS excerpt, "
            "bm25(document_search, 0.0, 0.0, 4.0, 1.0) AS rank "
            "FROM document_search JOIN documents d ON d.id = document_search.document_id "
            "WHERE document_search MATCH :match_expression "
            "AND d.project_id = :project_id AND d.is_missing = 0 "
        )
        if include_superseded:
            statement = text(base_query + "ORDER BY rank LIMIT :limit")
        else:
            statement = text(base_query + "AND d.is_current = 1 ORDER BY rank LIMIT :limit")
        parameters = {
            "match_expression": match_expression,
            "project_id": project_id,
            "limit": limit,
        }
        rows = list((await session.execute(statement, parameters)).mappings())
        if not rows and len(tokens) > 1:
            parameters["match_expression"] = " OR ".join(f'"{token}"*' for token in tokens)
            rows = list((await session.execute(statement, parameters)).mappings())
        results = [
            SearchResult(
                document_id=str(row["document_id"]),
                sha256=str(row["sha256"]),
                file_name=str(row["file_name"]),
                relative_path=str(row["relative_path"]),
                version_number=int(row["version_number"]),
                excerpt=str(row["excerpt"] or ""),
                score=max(0.0, -float(row["rank"])),
            )
            for row in rows
        ]
        return SearchResponse(query=query, results=results, total=len(results))

    async def summary(self, session: AsyncSession, project_id: str) -> ProjectSummary:
        project = await self._project(session, project_id)
        document_count = await session.scalar(
            select(func.count(Document.id)).where(Document.project_id == project_id)
        )
        current_count = await session.scalar(
            select(func.count(Document.id)).where(
                Document.project_id == project_id,
                Document.is_current.is_(True),
            )
        )
        failed_count = await session.scalar(
            select(func.count(Document.id)).where(
                Document.project_id == project_id,
                Document.is_current.is_(True),
                Document.extraction_status != "ready",
            )
        )
        missing_count = await session.scalar(
            select(func.count(Document.id)).where(
                Document.project_id == project_id,
                Document.is_current.is_(True),
                Document.is_missing.is_(True),
            )
        )
        conversation_count = await session.scalar(
            select(func.count(Conversation.id)).where(Conversation.project_id == project_id)
        )
        review_count = await session.scalar(
            select(func.count(ReviewRecord.id)).where(ReviewRecord.project_id == project_id)
        )
        last_indexed = await session.scalar(
            select(func.max(Document.updated_at)).where(Document.project_id == project_id)
        )
        return ProjectSummary(
            project_id=project_id,
            document_count=document_count or 0,
            current_document_count=current_count or 0,
            failed_document_count=failed_count or 0,
            missing_document_count=missing_count or 0,
            conversation_count=conversation_count or 0,
            review_count=review_count or 0,
            workspace_configured=bool(project.settings.workspace_path),
            last_indexed_at=last_indexed,
        )
