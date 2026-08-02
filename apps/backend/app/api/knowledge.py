from __future__ import annotations

from fastapi import APIRouter, Query, Request, Response, status

from app.api.dependencies import SessionDep
from app.schemas.knowledge import (
    ChatRequest,
    ChatResponse,
    ConversationRead,
    DocumentPage,
    DocumentPreview,
    DocumentRead,
    ProjectSummary,
    ReindexSummary,
    ReviewCreate,
    ReviewRead,
    ReviewUpdate,
    ScanSummary,
    SearchResponse,
)
from app.schemas.workspace import (
    CrsCreate,
    CrsItemCreate,
    CrsItemUpdate,
    CrsRead,
    CrsUpdate,
    DirectoryListing,
    DocumentRelationships,
    DocumentWorkflowUpdate,
)
from app.services.chat import ChatService
from app.services.documents import DocumentService
from app.services.reviews import ReviewService
from app.services.workspace import CrsService, WorkspaceService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["knowledge"])
documents = DocumentService()
chat = ChatService()
reviews = ReviewService()
workspace = WorkspaceService()
crs = CrsService()


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


@router.post("/documents/reindex", response_model=ReindexSummary)
async def rebuild_document_passages(
    project_id: str,
    session: SessionDep,
) -> ReindexSummary:
    return await documents.rebuild_passages(session, project_id)


@router.get("/files", response_model=DirectoryListing)
async def browse_project_files(
    project_id: str,
    session: SessionDep,
    path: str = Query(default="", max_length=2000),
    query: str | None = Query(default=None, max_length=300),
) -> DirectoryListing:
    return await workspace.browse(
        session,
        project_id,
        relative_path=path,
        query=query,
    )


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


@router.patch("/documents/{document_id}", response_model=DocumentRead)
async def update_document_workflow(
    project_id: str,
    document_id: str,
    payload: DocumentWorkflowUpdate,
    session: SessionDep,
) -> DocumentRead:
    return await workspace.update_document(session, project_id, document_id, payload)


@router.get(
    "/documents/{document_id}/relationships",
    response_model=DocumentRelationships,
)
async def document_relationships(
    project_id: str,
    document_id: str,
    session: SessionDep,
) -> DocumentRelationships:
    return await workspace.relationships(session, project_id, document_id)


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


@router.patch("/reviews/{review_id}", response_model=ReviewRead)
async def update_review(
    project_id: str,
    review_id: str,
    payload: ReviewUpdate,
    session: SessionDep,
) -> ReviewRead:
    return await reviews.update(session, project_id, review_id, payload)


@router.get("/reviews/{review_id}", response_model=ReviewRead)
async def get_review(
    project_id: str,
    review_id: str,
    session: SessionDep,
) -> ReviewRead:
    return await reviews.get(session, project_id, review_id)


@router.get("/crs", response_model=list[CrsRead])
async def list_crs(
    project_id: str,
    session: SessionDep,
    document_id: str | None = Query(default=None, max_length=36),
) -> list[CrsRead]:
    return await crs.list(session, project_id, document_id=document_id)


@router.post("/crs", response_model=CrsRead, status_code=status.HTTP_201_CREATED)
async def create_crs(
    project_id: str,
    payload: CrsCreate,
    session: SessionDep,
) -> CrsRead:
    return await crs.create(session, project_id, payload)


@router.get("/crs/{sheet_id}", response_model=CrsRead)
async def get_crs(project_id: str, sheet_id: str, session: SessionDep) -> CrsRead:
    return await crs.get(session, project_id, sheet_id)


@router.patch("/crs/{sheet_id}", response_model=CrsRead)
async def update_crs(
    project_id: str,
    sheet_id: str,
    payload: CrsUpdate,
    session: SessionDep,
) -> CrsRead:
    return await crs.update(session, project_id, sheet_id, payload)


@router.post("/crs/{sheet_id}/items", response_model=CrsRead)
async def add_crs_item(
    project_id: str,
    sheet_id: str,
    payload: CrsItemCreate,
    session: SessionDep,
) -> CrsRead:
    return await crs.add_item(session, project_id, sheet_id, payload)


@router.patch("/crs/{sheet_id}/items/{item_id}", response_model=CrsRead)
async def update_crs_item(
    project_id: str,
    sheet_id: str,
    item_id: str,
    payload: CrsItemUpdate,
    session: SessionDep,
) -> CrsRead:
    return await crs.update_item(session, project_id, sheet_id, item_id, payload)


@router.delete("/crs/{sheet_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_crs_item(
    project_id: str,
    sheet_id: str,
    item_id: str,
    session: SessionDep,
) -> Response:
    await crs.delete_item(session, project_id, sheet_id, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/crs/{sheet_id}/export")
async def export_crs(
    project_id: str,
    sheet_id: str,
    session: SessionDep,
) -> Response:
    content = await crs.export_csv(session, project_id, sheet_id)
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="CRS-{sheet_id[:8]}.csv"'},
    )
