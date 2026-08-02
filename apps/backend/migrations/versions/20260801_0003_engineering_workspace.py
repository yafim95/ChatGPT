"""Add EDMS workflow, CRS, linked chats, and persistent retrieval memory.

Revision ID: 20260801_0003
Revises: 20260801_0002
Create Date: 2026-08-01
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "20260801_0003"
down_revision: str | None = "20260801_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _column_exists(table_name: str, column_name: str) -> bool:
    return any(
        column["name"] == column_name
        for column in sa.inspect(op.get_bind()).get_columns(table_name)
    )


def _index_exists(table_name: str, index_name: str) -> bool:
    return any(
        index["name"] == index_name
        for index in sa.inspect(op.get_bind()).get_indexes(table_name)
    )


def _add_column(table_name: str, column: sa.Column[object]) -> None:
    if not _column_exists(table_name, column.name):
        op.add_column(table_name, column)


def _add_document_workflow_columns() -> None:
    columns = [
        sa.Column(
            "is_core_memory",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("memory_category", sa.String(length=80), nullable=True),
        sa.Column(
            "workflow_state",
            sa.String(length=30),
            nullable=False,
            server_default="unreviewed",
        ),
        sa.Column("review_code", sa.String(length=20), nullable=True),
        sa.Column("review_closed_at", sa.DateTime(timezone=True), nullable=True),
    ]
    for column in columns:
        _add_column("documents", column)


def _add_project_settings_columns() -> None:
    columns = [
        sa.Column(
            "excluded_patterns",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column("ai_project_instructions", sa.Text(), nullable=True),
        sa.Column(
            "auto_create_crs",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "default_review_due_days",
            sa.Integer(),
            nullable=False,
            server_default="14",
        ),
    ]
    for column in columns:
        _add_column("project_settings", column)


def _add_application_settings_columns() -> None:
    columns = [
        sa.Column("visual_style", sa.String(length=30), nullable=False, server_default="glass"),
        sa.Column(
            "interface_density",
            sa.String(length=30),
            nullable=False,
            server_default="comfortable",
        ),
        sa.Column("reduce_motion", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("rag_chunk_size", sa.Integer(), nullable=False, server_default="1800"),
        sa.Column("rag_chunk_overlap", sa.Integer(), nullable=False, server_default="240"),
        sa.Column(
            "core_memory_result_limit",
            sa.Integer(),
            nullable=False,
            server_default="6",
        ),
        sa.Column(
            "selected_document_result_limit",
            sa.Integer(),
            nullable=False,
            server_default="8",
        ),
        sa.Column(
            "max_context_characters",
            sa.Integer(),
            nullable=False,
            server_default="90000",
        ),
        sa.Column(
            "chat_history_message_limit",
            sa.Integer(),
            nullable=False,
            server_default="16",
        ),
        sa.Column(
            "auto_include_core_memory",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("show_hidden_files", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "max_index_file_size_mb",
            sa.Integer(),
            nullable=False,
            server_default="150",
        ),
    ]
    for column in columns:
        _add_column("application_settings", column)


def _add_review_workflow_columns() -> None:
    columns = [
        sa.Column(
            "document_id",
            sa.String(length=36),
            nullable=True,
        ),
        sa.Column(
            "conversation_id",
            sa.String(length=36),
            nullable=True,
        ),
        sa.Column("reference_number", sa.String(length=120), nullable=True),
        sa.Column("discipline", sa.String(length=80), nullable=True),
        sa.Column(
            "workflow_state",
            sa.String(length=30),
            nullable=False,
            server_default="open",
        ),
        sa.Column("decision_code", sa.String(length=20), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    ]
    for column in columns:
        _add_column("review_records", column)
    if not _index_exists("review_records", "ix_review_records_document"):
        op.create_index(
            "ix_review_records_document",
            "review_records",
            ["document_id", "updated_at"],
            unique=False,
        )


def _create_chunks() -> None:
    if not _table_exists("document_chunks"):
        op.create_table(
            "document_chunks",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("document_id", sa.String(length=36), nullable=False),
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("chunk_index", sa.Integer(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("character_start", sa.Integer(), nullable=False),
            sa.Column("character_end", sa.Integer(), nullable=False),
            sa.Column("token_estimate", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _index_exists("document_chunks", "ix_document_chunks_project_document"):
        op.create_index(
            "ix_document_chunks_project_document",
            "document_chunks",
            ["project_id", "document_id"],
            unique=False,
        )
    if not _index_exists("document_chunks", "ix_document_chunks_document_index"):
        op.create_index(
            "ix_document_chunks_document_index",
            "document_chunks",
            ["document_id", "chunk_index"],
            unique=True,
        )
    op.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS document_chunk_search USING fts5("
        "chunk_id UNINDEXED, document_id UNINDEXED, project_id UNINDEXED, title, content, "
        "tokenize='unicode61 remove_diacritics 2')"
    )


def _create_conversation_links() -> None:
    if not _table_exists("conversation_documents"):
        op.create_table(
            "conversation_documents",
            sa.Column("conversation_id", sa.String(length=36), nullable=False),
            sa.Column("document_id", sa.String(length=36), nullable=False),
            sa.Column("relation_type", sa.String(length=30), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["conversation_id"],
                ["conversations.id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("conversation_id", "document_id"),
        )
    if not _index_exists("conversation_documents", "ix_conversation_documents_document"):
        op.create_index(
            "ix_conversation_documents_document",
            "conversation_documents",
            ["document_id", "created_at"],
            unique=False,
        )


def _create_crs() -> None:
    if not _table_exists("comment_reply_sheets"):
        op.create_table(
            "comment_reply_sheets",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("document_id", sa.String(length=36), nullable=False),
            sa.Column("review_id", sa.String(length=36), nullable=True),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("reference_number", sa.String(length=120), nullable=True),
            sa.Column("revision", sa.String(length=40), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["review_id"],
                ["review_records.id"],
                ondelete="SET NULL",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _index_exists("comment_reply_sheets", "ix_crs_project_updated"):
        op.create_index(
            "ix_crs_project_updated",
            "comment_reply_sheets",
            ["project_id", "updated_at"],
            unique=False,
        )
    if not _index_exists("comment_reply_sheets", "ix_crs_document"):
        op.create_index(
            "ix_crs_document",
            "comment_reply_sheets",
            ["document_id", "status"],
            unique=False,
        )
    if not _table_exists("crs_items"):
        op.create_table(
            "crs_items",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("sheet_id", sa.String(length=36), nullable=False),
            sa.Column("item_number", sa.Integer(), nullable=False),
            sa.Column("location", sa.String(length=200), nullable=True),
            sa.Column("consultant_comment", sa.Text(), nullable=False),
            sa.Column("contractor_reply", sa.Text(), nullable=True),
            sa.Column("consultant_response", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["sheet_id"],
                ["comment_reply_sheets.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _index_exists("crs_items", "ix_crs_items_sheet_status"):
        op.create_index(
            "ix_crs_items_sheet_status",
            "crs_items",
            ["sheet_id", "status"],
            unique=False,
        )


def _backfill_chunks() -> None:
    connection = op.get_bind()
    existing = connection.execute(sa.text("SELECT COUNT(*) FROM document_chunks")).scalar_one()
    if existing:
        return
    rows = connection.execute(
        sa.text(
            "SELECT id, project_id, file_name, extracted_text FROM documents "
            "WHERE extraction_status = 'ready' AND extracted_text != ''"
        )
    ).mappings()
    for row in rows:
        content = str(row["extracted_text"])
        for index, start in enumerate(range(0, len(content), 1560)):
            chunk_content = content[start : start + 1800]
            if not chunk_content.strip():
                continue
            chunk_id = str(uuid4())
            values = {
                "id": chunk_id,
                "document_id": row["id"],
                "project_id": row["project_id"],
                "chunk_index": index,
                "content": chunk_content,
                "character_start": start,
                "character_end": start + len(chunk_content),
                "token_estimate": max(1, len(chunk_content) // 4),
                "title": row["file_name"],
            }
            connection.execute(
                sa.text(
                    "INSERT INTO document_chunks(id, document_id, project_id, chunk_index, "
                    "content, character_start, character_end, token_estimate) VALUES "
                    "(:id, :document_id, :project_id, :chunk_index, :content, "
                    ":character_start, :character_end, :token_estimate)"
                ),
                values,
            )
            connection.execute(
                sa.text(
                    "INSERT INTO document_chunk_search(chunk_id, document_id, project_id, "
                    "title, content) VALUES (:id, :document_id, :project_id, :title, :content)"
                ),
                values,
            )


def _upgrade_default_review_codes() -> None:
    connection = op.get_bind()
    old_default = [
        {"code": "1", "label": "Approved"},
        {"code": "2", "label": "Approved with comments"},
        {"code": "3", "label": "Revise and resubmit"},
        {"code": "4", "label": "Rejected"},
    ]
    new_default = [
        {"code": "1", "label": "Approved"},
        {"code": "2", "label": "Revise and resubmit — work may proceed"},
        {"code": "3", "label": "Revise and resubmit — work may not proceed"},
    ]
    rows = connection.execute(
        sa.text("SELECT project_id, review_codes FROM project_settings")
    ).mappings()
    for row in rows:
        try:
            current = json.loads(str(row["review_codes"]))
        except (TypeError, json.JSONDecodeError):
            continue
        if current == old_default:
            connection.execute(
                sa.text(
                    "UPDATE project_settings SET review_codes = :codes WHERE project_id = :id"
                ),
                {"codes": json.dumps(new_default), "id": row["project_id"]},
            )


def upgrade() -> None:
    _add_document_workflow_columns()
    _add_project_settings_columns()
    _add_application_settings_columns()
    _add_review_workflow_columns()
    _create_chunks()
    _create_conversation_links()
    _create_crs()
    _backfill_chunks()
    _upgrade_default_review_codes()


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS document_chunk_search")
    op.drop_index("ix_crs_items_sheet_status", table_name="crs_items")
    op.drop_table("crs_items")
    op.drop_index("ix_crs_document", table_name="comment_reply_sheets")
    op.drop_index("ix_crs_project_updated", table_name="comment_reply_sheets")
    op.drop_table("comment_reply_sheets")
    op.drop_index("ix_conversation_documents_document", table_name="conversation_documents")
    op.drop_table("conversation_documents")
    op.drop_index("ix_document_chunks_document_index", table_name="document_chunks")
    op.drop_index("ix_document_chunks_project_document", table_name="document_chunks")
    op.drop_table("document_chunks")
    op.drop_index("ix_review_records_document", table_name="review_records")

    for column_name in [
        "closed_at",
        "due_at",
        "decision_code",
        "workflow_state",
        "discipline",
        "reference_number",
        "conversation_id",
        "document_id",
    ]:
        op.drop_column("review_records", column_name)
    for column_name in [
        "max_index_file_size_mb",
        "show_hidden_files",
        "auto_include_core_memory",
        "chat_history_message_limit",
        "max_context_characters",
        "selected_document_result_limit",
        "core_memory_result_limit",
        "rag_chunk_overlap",
        "rag_chunk_size",
        "reduce_motion",
        "interface_density",
        "visual_style",
    ]:
        op.drop_column("application_settings", column_name)
    for column_name in [
        "default_review_due_days",
        "auto_create_crs",
        "ai_project_instructions",
        "excluded_patterns",
    ]:
        op.drop_column("project_settings", column_name)
    for column_name in [
        "review_closed_at",
        "review_code",
        "workflow_state",
        "memory_category",
        "is_core_memory",
    ]:
        op.drop_column("documents", column_name)
