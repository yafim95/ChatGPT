"""Add usable project workspaces, document knowledge, chat, reviews, and settings.

Revision ID: 20260801_0002
Revises: 20260718_0001
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260801_0002"
down_revision: str | None = "20260718_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _column_exists(table_name: str, column_name: str) -> bool:
    columns = sa.inspect(op.get_bind()).get_columns(table_name)
    return any(column["name"] == column_name for column in columns)


def _index_exists(table_name: str, index_name: str) -> bool:
    indexes = sa.inspect(op.get_bind()).get_indexes(table_name)
    return any(index["name"] == index_name for index in indexes)


def _add_project_settings_columns() -> None:
    if not _column_exists("project_settings", "workspace_path"):
        op.add_column("project_settings", sa.Column("workspace_path", sa.Text(), nullable=True))
    if not _column_exists("project_settings", "include_subfolders"):
        op.add_column(
            "project_settings",
            sa.Column(
                "include_subfolders",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )
    if not _column_exists("project_settings", "auto_scan_enabled"):
        op.add_column(
            "project_settings",
            sa.Column(
                "auto_scan_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )


def _add_application_settings_columns() -> None:
    columns = [
        sa.Column(
            "backup_retention_count",
            sa.Integer(),
            nullable=False,
            server_default="10",
        ),
        sa.Column("start_view", sa.String(length=30), nullable=False, server_default="last"),
        sa.Column(
            "compact_navigation",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "external_ai_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "ai_provider",
            sa.String(length=40),
            nullable=False,
            server_default="moonshot",
        ),
        sa.Column(
            "ai_base_url",
            sa.String(length=300),
            nullable=False,
            server_default="https://api.moonshot.ai/v1",
        ),
        sa.Column(
            "ai_model",
            sa.String(length=120),
            nullable=False,
            server_default="kimi-k3",
        ),
        sa.Column(
            "ai_reasoning_effort",
            sa.String(length=20),
            nullable=False,
            server_default="high",
        ),
        sa.Column(
            "ai_timeout_seconds",
            sa.Integer(),
            nullable=False,
            server_default="180",
        ),
        sa.Column(
            "ai_max_output_tokens",
            sa.Integer(),
            nullable=False,
            server_default="16000",
        ),
        sa.Column(
            "retrieval_result_limit",
            sa.Integer(),
            nullable=False,
            server_default="8",
        ),
        sa.Column(
            "include_superseded_search",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "save_chat_history",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("default_project_root", sa.Text(), nullable=True),
        sa.Column(
            "diagnostic_logging_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    ]
    for column in columns:
        if not _column_exists("application_settings", column.name):
            op.add_column("application_settings", column)


def _create_documents() -> None:
    if not _table_exists("documents"):
        op.create_table(
            "documents",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("revision_group_id", sa.String(length=36), nullable=False),
            sa.Column("relative_path", sa.Text(), nullable=False),
            sa.Column("source_path", sa.Text(), nullable=False),
            sa.Column("file_name", sa.String(length=255), nullable=False),
            sa.Column("extension", sa.String(length=20), nullable=False),
            sa.Column("mime_type", sa.String(length=120), nullable=True),
            sa.Column("sha256", sa.String(length=64), nullable=False),
            sa.Column("duplicate_of_id", sa.String(length=36), nullable=True),
            sa.Column("size_bytes", sa.BigInteger(), nullable=False),
            sa.Column("source_modified_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("page_count", sa.Integer(), nullable=True),
            sa.Column("word_count", sa.Integer(), nullable=False),
            sa.Column("extracted_text", sa.Text(), nullable=False),
            sa.Column("extraction_status", sa.String(length=30), nullable=False),
            sa.Column("extraction_error", sa.Text(), nullable=True),
            sa.Column("version_number", sa.Integer(), nullable=False),
            sa.Column("is_current", sa.Boolean(), nullable=False),
            sa.Column("is_missing", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _column_exists("documents", "source_path"):
        op.add_column("documents", sa.Column("source_path", sa.Text(), nullable=True))
    indexes = [
        ("ix_documents_project_current", ["project_id", "is_current"]),
        ("ix_documents_project_path", ["project_id", "relative_path"]),
        ("ix_documents_revision_group", ["revision_group_id", "version_number"]),
        ("ix_documents_sha256", ["sha256"]),
    ]
    for name, columns in indexes:
        if not _index_exists("documents", name):
            op.create_index(name, "documents", columns, unique=False)


def _create_conversations() -> None:
    if not _table_exists("conversations"):
        op.create_table(
            "conversations",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("mode", sa.String(length=30), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _index_exists("conversations", "ix_conversations_project_updated"):
        op.create_index(
            "ix_conversations_project_updated",
            "conversations",
            ["project_id", "updated_at"],
            unique=False,
        )

    if not _table_exists("chat_messages"):
        op.create_table(
            "chat_messages",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("conversation_id", sa.String(length=36), nullable=False),
            sa.Column("role", sa.String(length=20), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("sources", sa.JSON(), nullable=False),
            sa.Column("provider_message", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["conversation_id"],
                ["conversations.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _column_exists("chat_messages", "provider_message"):
        op.add_column("chat_messages", sa.Column("provider_message", sa.JSON(), nullable=True))
    if not _index_exists("chat_messages", "ix_chat_messages_conversation_created"):
        op.create_index(
            "ix_chat_messages_conversation_created",
            "chat_messages",
            ["conversation_id", "created_at"],
            unique=False,
        )


def _create_reviews() -> None:
    if not _table_exists("review_records"):
        op.create_table(
            "review_records",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("review_type", sa.String(length=50), nullable=False),
            sa.Column("instructions", sa.Text(), nullable=False),
            sa.Column("result", sa.Text(), nullable=False),
            sa.Column("sources", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _index_exists("review_records", "ix_review_records_project_updated"):
        op.create_index(
            "ix_review_records_project_updated",
            "review_records",
            ["project_id", "updated_at"],
            unique=False,
        )


def upgrade() -> None:
    _add_project_settings_columns()
    _add_application_settings_columns()
    op.execute("UPDATE application_settings SET telemetry_enabled = 0")
    _create_documents()
    _create_conversations()
    _create_reviews()
    op.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS document_search USING fts5("
        "document_id UNINDEXED, project_id UNINDEXED, title, content, "
        "tokenize='unicode61 remove_diacritics 2')"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS document_search")
    op.drop_index("ix_review_records_project_updated", table_name="review_records")
    op.drop_table("review_records")
    op.drop_index("ix_chat_messages_conversation_created", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_conversations_project_updated", table_name="conversations")
    op.drop_table("conversations")
    op.drop_index("ix_documents_sha256", table_name="documents")
    op.drop_index("ix_documents_revision_group", table_name="documents")
    op.drop_index("ix_documents_project_path", table_name="documents")
    op.drop_index("ix_documents_project_current", table_name="documents")
    op.drop_table("documents")

    for column_name in [
        "diagnostic_logging_enabled",
        "default_project_root",
        "save_chat_history",
        "include_superseded_search",
        "retrieval_result_limit",
        "ai_max_output_tokens",
        "ai_timeout_seconds",
        "ai_reasoning_effort",
        "ai_model",
        "ai_base_url",
        "ai_provider",
        "external_ai_enabled",
        "compact_navigation",
        "start_view",
        "backup_retention_count",
    ]:
        op.drop_column("application_settings", column_name)
    for column_name in ["auto_scan_enabled", "include_subfolders", "workspace_path"]:
        op.drop_column("project_settings", column_name)
