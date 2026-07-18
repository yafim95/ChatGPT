from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from app.schemas.common import ApiModel

DEFAULT_DISCIPLINES = ["Civil", "Structural", "Architectural", "MEP"]
DEFAULT_REVIEW_CODES = [
    {"code": "1", "label": "Approved"},
    {"code": "2", "label": "Approved with comments"},
    {"code": "3", "label": "Revise and resubmit"},
    {"code": "4", "label": "Rejected"},
]
DEFAULT_DOCUMENT_HIERARCHY = [
    "Contract",
    "Employer Requirements",
    "Specifications",
    "IFC Drawings",
    "Shop Drawings",
    "Submittals",
    "Correspondence",
]
DEFAULT_DOCUMENT_PRECEDENCE = [
    "Approved authority requirements",
    "Contract and Employer Requirements",
    "Approved project specifications",
    "Approved IFC drawings",
    "Approved submittals",
]


class ProjectSettingsCreate(ApiModel):
    timezone: str = Field(default="Asia/Dubai", min_length=1, max_length=80)
    locale: str = Field(default="en-AE", min_length=2, max_length=20)
    disciplines: list[str] = Field(default_factory=lambda: list(DEFAULT_DISCIPLINES), max_length=50)
    review_codes: list[dict[str, str]] = Field(
        default_factory=lambda: [dict(item) for item in DEFAULT_REVIEW_CODES],
        max_length=20,
    )
    document_hierarchy: list[str] = Field(
        default_factory=lambda: list(DEFAULT_DOCUMENT_HIERARCHY),
        max_length=50,
    )
    document_precedence: list[str] = Field(
        default_factory=lambda: list(DEFAULT_DOCUMENT_PRECEDENCE),
        max_length=50,
    )


class ProjectCreate(ApiModel):
    name: str = Field(min_length=2, max_length=200)
    project_number: str = Field(min_length=1, max_length=80)
    client: str | None = Field(default=None, max_length=200)
    consultant: str | None = Field(default=None, max_length=200)
    contractor: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    settings: ProjectSettingsCreate = Field(default_factory=ProjectSettingsCreate)

    @field_validator("name", "project_number", "client", "consultant", "contractor", mode="before")
    @classmethod
    def _strip_strings(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("project_number")
    @classmethod
    def _normalize_number(cls, value: str) -> str:
        return value.upper()


class ProjectUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    project_number: str | None = Field(default=None, min_length=1, max_length=80)
    client: str | None = Field(default=None, max_length=200)
    consultant: str | None = Field(default=None, max_length=200)
    contractor: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("name", "project_number", "client", "consultant", "contractor", mode="before")
    @classmethod
    def _strip_strings(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("project_number")
    @classmethod
    def _normalize_number(cls, value: str | None) -> str | None:
        return value.upper() if value else value


class ProjectSettingsRead(ApiModel):
    timezone: str
    locale: str
    disciplines: list[str]
    review_codes: list[dict[str, str]]
    document_hierarchy: list[str]
    document_precedence: list[str]


class ProjectRead(ApiModel):
    id: str
    name: str
    project_number: str
    client: str | None
    consultant: str | None
    contractor: str | None
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    settings: ProjectSettingsRead
