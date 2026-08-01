from __future__ import annotations

import asyncio
import sqlite3
from pathlib import Path
from typing import Any

import pytest
from app.core.config import AppConfig, Environment
from app.services.maintenance import create_pre_migration_backup
from app.services.provider import ProviderClient, ProviderCompletion
from httpx import AsyncClient
from pypdf import PdfWriter


async def _create_project(client: AsyncClient, workspace: Path) -> dict[str, object]:
    response = await client.post(
        "/api/projects",
        json={
            "name": "Knowledge Project",
            "project_number": "KNOW-001",
            "settings": {"workspace_path": str(workspace)},
        },
    )
    assert response.status_code == 201
    return response.json()


async def test_project_folder_scan_search_revision_and_missing_file(
    client: AsyncClient,
    tmp_path: Path,
) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    requirement = workspace / "Employer Requirements.txt"
    requirement.write_text(
        "The allowable total settlement shall not exceed 25 mm over 50 years.",
        encoding="utf-8",
    )
    duplicate = workspace / "Copy of Requirements.txt"
    duplicate.write_text(requirement.read_text(encoding="utf-8"), encoding="utf-8")
    project = await _create_project(client, workspace)
    project_id = project["id"]

    scan = await client.post(f"/api/projects/{project_id}/documents/scan")
    assert scan.status_code == 200
    assert scan.json()["discovered"] == 2
    assert scan.json()["added"] == 2

    documents = await client.get(f"/api/projects/{project_id}/documents")
    assert documents.status_code == 200
    assert documents.json()["total"] == 2
    assert any(item["duplicate_of_id"] for item in documents.json()["items"])

    search = await client.get(
        f"/api/projects/{project_id}/documents/search",
        params={"query": "allowable settlement"},
    )
    assert search.status_code == 200
    assert search.json()["total"] == 2
    assert "25 mm" in search.json()["results"][0]["excerpt"]

    requirement.write_text(
        "The revised allowable total settlement shall not exceed 20 mm.",
        encoding="utf-8",
    )
    second_scan = await client.post(f"/api/projects/{project_id}/documents/scan")
    assert second_scan.json()["updated"] == 1

    versions = await client.get(
        f"/api/projects/{project_id}/documents",
        params={"include_versions": "true"},
    )
    assert versions.json()["total"] == 3
    assert sorted(
        item["version_number"]
        for item in versions.json()["items"]
        if item["file_name"] == requirement.name
    ) == [1, 2]

    current_search = await client.get(
        f"/api/projects/{project_id}/documents/search",
        params={"query": "25 mm"},
    )
    assert current_search.json()["total"] == 1
    assert current_search.json()["results"][0]["file_name"] == duplicate.name

    historical_search = await client.get(
        f"/api/projects/{project_id}/documents/search",
        params={"query": "25 mm", "include_superseded": "true"},
    )
    assert historical_search.json()["total"] == 2
    assert {item["version_number"] for item in historical_search.json()["results"]} == {1}

    duplicate.unlink()
    missing_scan = await client.post(f"/api/projects/{project_id}/documents/scan")
    assert missing_scan.json()["missing"] == 1


async def test_local_evidence_mode_does_not_call_provider_without_results(
    client: AsyncClient,
    tmp_path: Path,
) -> None:
    project = await _create_project(client, tmp_path / "empty-workspace")
    (tmp_path / "empty-workspace").mkdir()
    project_id = project["id"]
    key_response = await client.put(
        "/api/provider/key",
        json={"api_key": "test-provider-key-value"},
    )
    assert key_response.status_code == 200
    settings = await client.patch(
        "/api/settings",
        json={"external_ai_enabled": True},
    )
    assert settings.status_code == 200

    response = await client.post(
        f"/api/projects/{project_id}/chat",
        json={"message": "What is the approved concrete grade?", "mode": "evidence"},
    )
    assert response.status_code == 200
    assert response.json()["local_only"] is True
    assert response.json()["sources"] == []


async def test_document_versions_keep_their_original_source_path(
    client: AsyncClient,
    tmp_path: Path,
) -> None:
    original_workspace = tmp_path / "original-workspace"
    original_workspace.mkdir()
    source = original_workspace / "Specification.txt"
    source.write_text("Original project specification.", encoding="utf-8")
    project = await _create_project(client, original_workspace)
    project_id = project["id"]
    await client.post(f"/api/projects/{project_id}/documents/scan")

    replacement_workspace = tmp_path / "replacement-workspace"
    replacement_workspace.mkdir()
    updated = await client.patch(
        f"/api/projects/{project_id}/settings",
        json={"workspace_path": str(replacement_workspace)},
    )
    documents = await client.get(f"/api/projects/{project_id}/documents")

    assert updated.status_code == 200
    assert documents.json()["items"][0]["absolute_path"] == str(source)


async def test_image_only_pdf_is_reported_as_needing_ocr(
    client: AsyncClient,
    tmp_path: Path,
) -> None:
    workspace = tmp_path / "scanned-documents"
    workspace.mkdir()
    pdf_path = workspace / "Scanned drawing.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    with pdf_path.open("wb") as stream:
        writer.write(stream)
    project = await _create_project(client, workspace)

    scan = await client.post(f"/api/projects/{project['id']}/documents/scan")
    documents = await client.get(f"/api/projects/{project['id']}/documents")

    assert scan.status_code == 200
    assert scan.json()["failed"] == 1
    assert documents.json()["items"][0]["extraction_status"] == "no_text"
    assert "OCR" in documents.json()["items"][0]["extraction_error"]


async def test_removing_current_document_clears_revision_group_from_search(
    client: AsyncClient,
    tmp_path: Path,
) -> None:
    workspace = tmp_path / "removal-workspace"
    workspace.mkdir()
    source = workspace / "Fire Strategy.txt"
    source.write_text("The original fire rating is 60 minutes.", encoding="utf-8")
    project = await _create_project(client, workspace)
    project_id = project["id"]
    await client.post(f"/api/projects/{project_id}/documents/scan")
    source.write_text("The revised fire rating is 90 minutes.", encoding="utf-8")
    await client.post(f"/api/projects/{project_id}/documents/scan")

    versions = await client.get(
        f"/api/projects/{project_id}/documents",
        params={"include_versions": "true"},
    )
    current = next(item for item in versions.json()["items"] if item["is_current"])
    removed = await client.delete(f"/api/projects/{project_id}/documents/{current['id']}")
    historical_search = await client.get(
        f"/api/projects/{project_id}/documents/search",
        params={"query": "fire rating", "include_superseded": "true"},
    )

    assert removed.status_code == 204
    assert historical_search.json()["total"] == 0

    rescanned = await client.post(f"/api/projects/{project_id}/documents/scan")
    current_search = await client.get(
        f"/api/projects/{project_id}/documents/search",
        params={"query": "fire rating"},
    )
    assert rescanned.json()["added"] == 1
    assert current_search.json()["total"] == 1


async def test_project_chat_preserves_k3_messages_and_controlled_context(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace = tmp_path / "chat-workspace"
    workspace.mkdir()
    (workspace / "Warranty.txt").write_text(
        "The fire stopping system warranty shall be 10 years.",
        encoding="utf-8",
    )
    project = await _create_project(client, workspace)
    project_id = project["id"]
    await client.post(f"/api/projects/{project_id}/documents/scan")
    await client.put(
        "/api/provider/key",
        json={"api_key": "test-provider-key-value"},
    )
    await client.patch("/api/settings", json={"external_ai_enabled": True})

    requests: list[list[dict[str, Any]]] = []

    async def fake_complete(
        _client: ProviderClient,
        _settings: object,
        _api_key: str,
        messages: list[dict[str, Any]],
    ) -> ProviderCompletion:
        requests.append(messages)
        answer = "The indexed requirement states a 10-year warranty [S1]."
        return ProviderCompletion(
            content=answer,
            message={
                "role": "assistant",
                "content": answer,
                "reasoning_content": "The cited excerpt directly states the duration.",
            },
        )

    monkeypatch.setattr(ProviderClient, "complete", fake_complete)
    first = await client.post(
        f"/api/projects/{project_id}/chat",
        json={"message": "What is the fire stopping warranty?", "mode": "evidence"},
    )
    assert first.status_code == 200
    assert first.json()["sources"][0]["file_name"] == "Warranty.txt"
    assert "Project timezone: Asia/Dubai" in requests[0][-1]["content"]
    assert "Disciplines: Civil" in requests[0][-1]["content"]
    assert "Review codes: 1=Approved" in requests[0][-1]["content"]

    second = await client.post(
        f"/api/projects/{project_id}/chat",
        json={
            "message": "Restate the fire stopping warranty duration.",
            "mode": "evidence",
            "conversation_id": first.json()["conversation_id"],
        },
    )
    assert second.status_code == 200
    assert any(
        message.get("reasoning_content") == "The cited excerpt directly states the duration."
        for message in requests[1]
    )


async def test_manual_backup_and_dashboard(client: AsyncClient, tmp_path: Path) -> None:
    workspace = tmp_path / "backup-workspace"
    workspace.mkdir()
    await _create_project(client, workspace)

    dashboard = await client.get("/api/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["active_project_count"] == 1

    backup = await client.post("/api/maintenance/backup")
    assert backup.status_code == 200
    assert await asyncio.to_thread(Path(backup.json()["path"]).is_file)

    info = await client.get("/api/maintenance")
    assert info.status_code == 200
    assert info.json()["backups"][0]["file_name"] == backup.json()["file_name"]


def test_pre_migration_backup_preserves_an_older_database(tmp_path: Path) -> None:
    config = AppConfig(environment=Environment.TEST, data_dir=tmp_path)
    config.prepare_directories()
    with sqlite3.connect(config.database_path) as connection:
        connection.execute("CREATE TABLE alembic_version (version_num TEXT NOT NULL)")
        connection.execute("INSERT INTO alembic_version VALUES ('20260718_0001')")
        connection.execute("CREATE TABLE marker (value TEXT NOT NULL)")
        connection.execute("INSERT INTO marker VALUES ('preserved')")

    backup = create_pre_migration_backup(config, "20260801_0002")

    assert backup is not None
    assert backup.is_file()
    with sqlite3.connect(backup) as connection:
        assert connection.execute("SELECT value FROM marker").fetchone() == ("preserved",)
