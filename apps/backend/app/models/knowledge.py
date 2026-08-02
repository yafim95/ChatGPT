"""Local document knowledge, conversations, and engineering review records."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project


class Document(TimestampMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_project_current", "project_id", "is_current"),
        Index("ix_documents_project_path", "project_id", "relative_path"),
        Index("ix_documents_revision_group", "revision_group_id", "version_number"),
        Index("ix_documents_sha256", "sha256"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    revision_group_id: Mapped[str] = mapped_column(String(36), nullable=False)
    relative_path: Mapped[str] = mapped_column(Text, nullable=False)
    source_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    extension: Mapped[str] = mapped_column(String(20), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(120))
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    duplicate_of_id: Mapped[str | None] = mapped_column(String(36))
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    source_modified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer)
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    extraction_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    extraction_error: Mapped[str | None] = mapped_column(Text)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_missing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_core_memory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    memory_category: Mapped[str | None] = mapped_column(String(80))
    workflow_state: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="unreviewed",
    )
    review_code: Mapped[str | None] = mapped_column(String(20))
    review_closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped[Project] = relationship(back_populates="documents")
    chunks: Mapped[list[DocumentChunk]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    conversation_links: Mapped[list[ConversationDocument]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    reviews: Mapped[list[ReviewRecord]] = relationship(
        back_populates="document",
        lazy="raise",
    )
    crs_sheets: Mapped[list[CommentReplySheet]] = relationship(
        back_populates="document",
        lazy="raise",
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        Index("ix_document_chunks_project_document", "project_id", "document_id"),
        Index("ix_document_chunks_document_index", "document_id", "chunk_index", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    document_id: Mapped[str] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    character_start: Mapped[int] = mapped_column(Integer, nullable=False)
    character_end: Mapped[int] = mapped_column(Integer, nullable=False)
    token_estimate: Mapped[int] = mapped_column(Integer, nullable=False)

    document: Mapped[Document] = relationship(back_populates="chunks")


class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"
    __table_args__ = (Index("ix_conversations_project_updated", "project_id", "updated_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    mode: Mapped[str] = mapped_column(String(30), nullable=False, default="evidence")

    project: Mapped[Project] = relationship(back_populates="conversations")
    messages: Mapped[list[ChatMessage]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
        lazy="selectin",
    )
    document_links: Mapped[list[ConversationDocument]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ConversationDocument(Base):
    __tablename__ = "conversation_documents"
    __table_args__ = (Index("ix_conversation_documents_document", "document_id", "created_at"),)

    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    document_id: Mapped[str] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
    )
    relation_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="context",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    conversation: Mapped[Conversation] = relationship(back_populates="document_links")
    document: Mapped[Document] = relationship(back_populates="conversation_links")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("ix_chat_messages_conversation_created", "conversation_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    provider_message: Mapped[dict[str, object] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class ReviewRecord(TimestampMixin, Base):
    __tablename__ = "review_records"
    __table_args__ = (Index("ix_review_records_project_updated", "project_id", "updated_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    document_id: Mapped[str | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"),
    )
    conversation_id: Mapped[str | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"),
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    review_type: Mapped[str] = mapped_column(String(50), nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(120))
    discipline: Mapped[str | None] = mapped_column(String(80))
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    result: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[list[dict[str, object]]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    workflow_state: Mapped[str] = mapped_column(String(30), nullable=False, default="open")
    decision_code: Mapped[str | None] = mapped_column(String(20))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped[Project] = relationship(back_populates="reviews")
    document: Mapped[Document | None] = relationship(back_populates="reviews")
    conversation: Mapped[Conversation | None] = relationship()
    crs_sheets: Mapped[list[CommentReplySheet]] = relationship(
        back_populates="review",
        lazy="selectin",
    )


class CommentReplySheet(TimestampMixin, Base):
    __tablename__ = "comment_reply_sheets"
    __table_args__ = (
        Index("ix_crs_project_updated", "project_id", "updated_at"),
        Index("ix_crs_document", "document_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    document_id: Mapped[str] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    review_id: Mapped[str | None] = mapped_column(
        ForeignKey("review_records.id", ondelete="SET NULL"),
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(120))
    revision: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")

    project: Mapped[Project] = relationship(back_populates="crs_sheets")
    document: Mapped[Document] = relationship(back_populates="crs_sheets")
    review: Mapped[ReviewRecord | None] = relationship(back_populates="crs_sheets")
    items: Mapped[list[CrsItem]] = relationship(
        back_populates="sheet",
        cascade="all, delete-orphan",
        order_by="CrsItem.item_number",
        lazy="selectin",
    )


class CrsItem(TimestampMixin, Base):
    __tablename__ = "crs_items"
    __table_args__ = (Index("ix_crs_items_sheet_status", "sheet_id", "status"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    sheet_id: Mapped[str] = mapped_column(
        ForeignKey("comment_reply_sheets.id", ondelete="CASCADE"),
        nullable=False,
    )
    item_number: Mapped[int] = mapped_column(Integer, nullable=False)
    location: Mapped[str | None] = mapped_column(String(200))
    consultant_comment: Mapped[str] = mapped_column(Text, nullable=False)
    contractor_reply: Mapped[str | None] = mapped_column(Text)
    consultant_response: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")

    sheet: Mapped[CommentReplySheet] = relationship(back_populates="items")
