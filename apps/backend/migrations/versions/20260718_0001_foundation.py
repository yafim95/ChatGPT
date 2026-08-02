"""Create Phase 1 project, settings, and audit entities.

Revision ID: 20260718_0001
Revises:
Create Date: 2026-07-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260718_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _index_exists(table_name: str, index_name: str) -> bool:
    indexes = sa.inspect(op.get_bind()).get_indexes(table_name)
    return any(index["name"] == index_name for index in indexes)


def upgrade() -> None:
    # SQLite DDL is not transactional. If the application is interrupted during its
    # first migration, complete the missing tables and indexes on the next launch
    # instead of failing on the first table that already exists.
    if not _table_exists("projects"):
        op.create_table(
            "projects",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("project_number", sa.String(length=80), nullable=False),
            sa.Column("client", sa.String(length=200), nullable=True),
            sa.Column("consultant", sa.String(length=200), nullable=True),
            sa.Column("contractor", sa.String(length=200), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("project_number"),
        )
    if not _index_exists("projects", "ix_projects_name"):
        op.create_index("ix_projects_name", "projects", ["name"], unique=False)
    if not _index_exists("projects", "ix_projects_status"):
        op.create_index("ix_projects_status", "projects", ["status"], unique=False)

    if not _table_exists("project_settings"):
        op.create_table(
            "project_settings",
            sa.Column("project_id", sa.String(length=36), nullable=False),
            sa.Column("timezone", sa.String(length=80), nullable=False),
            sa.Column("locale", sa.String(length=20), nullable=False),
            sa.Column("disciplines", sa.JSON(), nullable=False),
            sa.Column("review_codes", sa.JSON(), nullable=False),
            sa.Column("document_hierarchy", sa.JSON(), nullable=False),
            sa.Column("document_precedence", sa.JSON(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("project_id"),
        )

    if not _table_exists("application_settings"):
        op.create_table(
            "application_settings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("brand_name", sa.String(length=120), nullable=False),
            sa.Column("theme", sa.String(length=20), nullable=False),
            sa.Column("locale", sa.String(length=20), nullable=False),
            sa.Column("telemetry_enabled", sa.Boolean(), nullable=False),
            sa.Column("auto_backup_enabled", sa.Boolean(), nullable=False),
            sa.Column("backup_interval_days", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists("audit_events"):
        op.create_table(
            "audit_events",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("actor", sa.String(length=80), nullable=False),
            sa.Column("action", sa.String(length=80), nullable=False),
            sa.Column("target_type", sa.String(length=80), nullable=False),
            sa.Column("target_id", sa.String(length=80), nullable=False),
            sa.Column("details", sa.JSON(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _index_exists("audit_events", "ix_audit_events_created_at"):
        op.create_index(
            "ix_audit_events_created_at",
            "audit_events",
            ["created_at"],
            unique=False,
        )
    if not _index_exists("audit_events", "ix_audit_events_target"):
        op.create_index(
            "ix_audit_events_target",
            "audit_events",
            ["target_type", "target_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index("ix_audit_events_target", table_name="audit_events")
    op.drop_index("ix_audit_events_created_at", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_table("application_settings")
    op.drop_table("project_settings")
    op.drop_index("ix_projects_status", table_name="projects")
    op.drop_index("ix_projects_name", table_name="projects")
    op.drop_table("projects")
