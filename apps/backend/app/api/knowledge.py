from __future__ import annotations

from fastapi import APIRouter, Query, Request, Response, status

from app.api.dependencies import SessionDep
from app.schemas.knowledge import (
    ChatRequest,
    ChatResponse,
    ConversationRead,
    DocumentPage,
    DocumentPreview,
    ProjectSummary,
    ReviewCreate,
    ReviewRead,
    ScanSummary,
    SearchResponse,
)
from app.services.chat import ChatService
from app.services.documents import DocumentService
from app.services.reviews import ReviewService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["knowledge"])
documents = DocumentService()
chat = ChatService()
reviews = ReviewService()


@router.get("/summary", response_model=ProjectSummary)
async def project_summary(project_id: str, session: SessionDep) -> ProjectSummary:
    return await documents.summary(session, project_id)


@router.get("/documents", response_model=DocumentPage)
async def list_documents(
    project_id: str,
    session: SessionDep,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    include_versions: bool = False,
    query: str | None = Query(default=None, max_length=300),
) -> DocumentPage:
    return await documents.list(
        session,
        project_id,
        limit=limit,
        offset=offset,
        include_versions=include_versions,
        query=query,
    )


@router.post("/documents/scan", response_model=ScanSummary)
async def scan_documents(project_id: str, session: SessionDep) -> ScanSummary:
    return await documents.scan(session, project_id)


@router.get("/documents/search", response_model=SearchResponse)
async def search_documents(
    project_id: str,
    session: SessionDep,
    query: str = Query(min_length=2, max_length=500),
    limit: int = Query(default=20, ge=1, le=50),
    include_superseded: bool = False,
) -> SearchResponse:
    return await documents.search(
        session,
        project_id,
        query,
        limit=limit,
        include_superseded=include_superseded,
    )


@router.get("/documents/{document_id}", response_model=DocumentPreview)
async def preview_document(
    project_id: str,
    document_id: str,
    session: SessionDep,
) -> DocumentPreview:
    return await documents.preview(session, project_id, document_id)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_document(
    project_id: str,
    document_id: str,
    session: SessionDep,
) -> Response:
    await documents.remove_from_index(session, project_id, document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/chat", response_model=ChatResponse)
async def ask_project(
    project_id: str,
    payload: ChatRequest,
    request: Request,
    session: SessionDep,
) -> ChatResponse:
    return await chat.ask(session, project_id, payload, request.app.state.secret_store)


@router.get("/conversations", response_model=list[ConversationRead])
async def list_conversations(
    project_id: str,
    session: SessionDep,
) -> list[ConversationRead]:
    return await chat.list_conversations(session, project_id)


@router.get("/conversations/{conversation_id}", response_model=ConversationRead)
async def get_conversation(
    project_id: str,
    conversation_id: str,
    session: SessionDep,
) -> ConversationRead:
    return await chat.get_conversation(session, project_id, conversation_id)


@router.get("/reviews", response_model=list[ReviewRead])
async def list_reviews(project_id: str, session: SessionDep) -> list[ReviewRead]:
    return await reviews.list(session, project_id)


@router.post("/reviews", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
async def create_review(
    project_id: str,
    payload: ReviewCreate,
    request: Request,
    session: SessionDep,
) -> ReviewRead:
    return await reviews.create(
        session,
        project_id,
        payload,
        request.app.state.secret_store,
    )


@router.get("/reviews/{review_id}", response_model=ReviewRead)
async def get_review(
    project_id: str,
    review_id: str,
    session: SessionDep,
) -> ReviewRead:
    return await reviews.get(session, project_id, review_id)
