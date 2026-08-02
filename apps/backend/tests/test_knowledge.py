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
    await client.patch(
        "/api/settings",
        json={"external_ai_enabled": True, "auto_include_core_memory": False},
    )

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


async def test_workspace_browser_workflow_and_path_boundaries(
    client: AsyncClient,
    tmp_path: Path,
) -> None:
    workspace = tmp_path / "document-control"
    (workspace / "Drawings").mkdir(parents=True)
    (workspace / "Archive").mkdir()
    (workspace / "Contract.txt").write_text(
        "The contract requires a 14-day technical review period.",
        encoding="utf-8",
    )
    (workspace / "Drawings" / "A-101.dwg").write_bytes(b"drawing-placeholder")
    (workspace / "Archive" / "Old Specification.txt").write_text(
        "Superseded archive text.",
        encoding="utf-8",
    )
    project = await _create_project(client, workspace)
    project_id = project["id"]
    settings = await client.patch(
        f"/api/projects/{project_id}/settings",
        json={"excluded_patterns": ["Archive*"]},
    )
    assert settings.status_code == 200

    scan = await client.post(f"/api/projects/{project_id}/documents/scan")
    assert scan.status_code == 200
    assert scan.json()["discovered"] == 1
    rebuilt = await client.post(f"/api/projects/{project_id}/documents/reindex")
    assert rebuilt.status_code == 200
    assert rebuilt.json()["documents"] == 1
    assert rebuilt.json()["passages"] == 1

    root = await client.get(f"/api/projects/{project_id}/files")
    assert root.status_code == 200
    assert [item["name"] for item in root.json()["items"]] == [
        "Drawings",
        "Contract.txt",
    ]
    contract = next(item for item in root.json()["items"] if item["name"] == "Contract.txt")
    assert contract["indexed_document_id"]

    drawings = await client.get(
        f"/api/projects/{project_id}/files",
        params={"path": "Drawings"},
    )
    assert drawings.status_code == 200
    assert drawings.json()["parent_path"] == ""
    assert drawings.json()["items"][0]["name"] == "A-101.dwg"
    assert drawings.json()["items"][0]["supported"] is False

    search = await client.get(
        f"/api/projects/{project_id}/files",
        params={"query": "A-101"},
    )
    assert search.status_code == 200
    assert search.json()["items"][0]["relative_path"] == "Drawings/A-101.dwg"

    escaped = await client.get(
        f"/api/projects/{project_id}/files",
        params={"path": "../"},
    )
    assert escaped.status_code == 409
    assert escaped.json()["error"]["code"] == "invalid_workspace_path"

    updated = await client.patch(
        f"/api/projects/{project_id}/documents/{contract['indexed_document_id']}",
        json={
            "is_core_memory": True,
            "memory_category": "Contract",
            "workflow_state": "under_review",
            "review_code": "2",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["is_core_memory"] is True
    assert updated.json()["memory_category"] == "Contract"
    assert updated.json()["workflow_state"] == "under_review"
    assert updated.json()["review_code"] == "2"

    invalid_code = await client.patch(
        f"/api/projects/{project_id}/documents/{contract['indexed_document_id']}",
        json={"review_code": "99"},
    )
    assert invalid_code.status_code == 409
    assert invalid_code.json()["error"]["code"] == "invalid_review_code"


async def test_chat_prioritizes_selected_files_and_persistent_project_memory(
    client: AsyncClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace = tmp_path / "rag-workspace"
    workspace.mkdir()
    (workspace / "Main Contract.txt").write_text(
        "Liquidated damages are AED 5,000 for each calendar day of delay.",
        encoding="utf-8",
    )
    (workspace / "Facade Submittal.txt").write_text(
        "The proposed aluminium coating colour is RAL 7016 anthracite grey.",
        encoding="utf-8",
    )
    project = await _create_project(client, workspace)
    project_id = project["id"]
    await client.post(f"/api/projects/{project_id}/documents/scan")
    documents = (await client.get(f"/api/projects/{project_id}/documents")).json()["items"]
    contract = next(item for item in documents if item["file_name"] == "Main Contract.txt")
    submittal = next(item for item in documents if item["file_name"] == "Facade Submittal.txt")
    memory = await client.patch(
        f"/api/projects/{project_id}/documents/{contract['id']}",
        json={"is_core_memory": True, "memory_category": "Contract"},
    )
    assert memory.status_code == 200
    await client.put("/api/provider/key", json={"api_key": "test-provider-key-value"})
    await client.patch(
        "/api/settings",
        json={"external_ai_enabled": True, "auto_include_core_memory": False},
    )

    provider_messages: list[list[dict[str, Any]]] = []

    async def fake_complete(
        _client: ProviderClient,
        _settings: object,
        _api_key: str,
        messages: list[dict[str, Any]],
    ) -> ProviderCompletion:
        provider_messages.append(messages)
        return ProviderCompletion(
            content="The selected finish is RAL 7016 [S1]; delay damages are AED 5,000/day [S2].",
            message={"role": "assistant", "content": "Evidence-linked response."},
        )

    monkeypatch.setattr(ProviderClient, "complete", fake_complete)
    answer = await client.post(
        f"/api/projects/{project_id}/chat",
        json={
            "message": "Compare the coating colour with the liquidated damages requirement.",
            "mode": "evidence",
            "document_ids": [submittal["id"]],
            "include_core_memory": True,
        },
    )
    assert answer.status_code == 200
    assert answer.json()["conversation_id"]
    tiers = {source["source_tier"] for source in answer.json()["sources"]}
    assert {"selected", "core_memory"}.issubset(tiers)
    assert "Project-specific AI instructions" in provider_messages[0][-1]["content"]

    conversation = await client.get(
        f"/api/projects/{project_id}/conversations/{answer.json()['conversation_id']}"
    )
    relations = {
        item["document_id"]: item["relation_type"] for item in conversation.json()["documents"]
    }
    assert relations[submittal["id"]] == "context"
    assert relations[contract["id"]] == "memory"

    related = await client.get(
        f"/api/projects/{project_id}/documents/{submittal['id']}/relationships"
    )
    assert related.status_code == 200
    assert related.json()["conversations"][0]["id"] == answer.json()["conversation_id"]
    assert related.json()["conversations"][0]["message_count"] == 2


async def test_manual_review_crs_decision_and_revision_lifecycle(
    client: AsyncClient,
    tmp_path: Path,
) -> None:
    workspace = tmp_path / "review-workspace"
    workspace.mkdir()
    source = workspace / "Structural Submittal.txt"
    source.write_text(
        "Beam B12 is proposed as 500 by 300 millimetres.",
        encoding="utf-8",
    )
    project = await _create_project(client, workspace)
    project_id = project["id"]
    await client.patch(
        f"/api/projects/{project_id}/settings",
        json={"auto_create_crs": False},
    )
    await client.post(f"/api/projects/{project_id}/documents/scan")
    document = (await client.get(f"/api/projects/{project_id}/documents")).json()["items"][0]

    review = await client.post(
        f"/api/projects/{project_id}/reviews",
        json={
            "title": "Structural submittal review · Rev 01",
            "review_type": "shop_drawing",
            "instructions": "Check dimensions against the controlled project requirements.",
            "document_id": document["id"],
            "reference_number": "SD-STR-0042",
            "discipline": "Structural",
            "generate_with_ai": False,
            "create_crs": True,
        },
    )
    assert review.status_code == 201
    assert len(review.json()["crs_ids"]) == 1
    review_id = review.json()["id"]
    sheet_id = review.json()["crs_ids"][0]

    added = await client.post(
        f"/api/projects/{project_id}/crs/{sheet_id}/items",
        json={
            "location": "Drawing S-201 / Beam B12",
            "consultant_comment": "Provide the governing design calculation for the proposed size.",
        },
    )
    assert added.status_code == 200
    assert added.json()["status"] == "open"
    item_id = added.json()["items"][0]["id"]

    closed_item = await client.patch(
        f"/api/projects/{project_id}/crs/{sheet_id}/items/{item_id}",
        json={
            "contractor_reply": "Calculation STR-CALC-118 submitted.",
            "consultant_response": "Accepted for this review stage.",
            "status": "closed",
        },
    )
    assert closed_item.status_code == 200
    assert closed_item.json()["status"] == "closed"

    exported = await client.get(f"/api/projects/{project_id}/crs/{sheet_id}/export")
    assert exported.status_code == 200
    assert "Consultant Comment" in exported.text
    assert "STR-CALC-118" in exported.text

    duplicate_sheet = await client.post(
        f"/api/projects/{project_id}/crs",
        json={
            "document_id": document["id"],
            "review_id": review_id,
            "title": "Duplicate CRS",
        },
    )
    assert duplicate_sheet.status_code == 409
    assert duplicate_sheet.json()["error"]["code"] == "crs_already_exists"

    invalid_decision = await client.patch(
        f"/api/projects/{project_id}/reviews/{review_id}",
        json={"decision_code": "99"},
    )
    assert invalid_decision.status_code == 409
    assert invalid_decision.json()["error"]["code"] == "invalid_review_code"

    assigned = await client.patch(
        f"/api/projects/{project_id}/reviews/{review_id}",
        json={"decision_code": "1"},
    )
    assert assigned.status_code == 200
    cleared = await client.patch(
        f"/api/projects/{project_id}/reviews/{review_id}",
        json={"decision_code": None},
    )
    assert cleared.status_code == 200
    refreshed_document = await client.get(f"/api/projects/{project_id}/documents/{document['id']}")
    assert refreshed_document.json()["document"]["review_code"] is None

    closed_review = await client.patch(
        f"/api/projects/{project_id}/reviews/{review_id}",
        json={"decision_code": "2", "workflow_state": "closed"},
    )
    assert closed_review.status_code == 200
    assert closed_review.json()["workflow_state"] == "closed"
    assert closed_review.json()["decision_code"] == "2"

    source.write_text(
        "Beam B12 is revised to 550 by 300 millimetres.",
        encoding="utf-8",
    )
    rescanned = await client.post(f"/api/projects/{project_id}/documents/scan")
    assert rescanned.json()["updated"] == 1
    current = (await client.get(f"/api/projects/{project_id}/documents")).json()["items"][0]
    assert current["version_number"] == 2
    assert current["workflow_state"] == "under_review"
    assert current["review_code"] is None

    relationships = await client.get(
        f"/api/projects/{project_id}/documents/{current['id']}/relationships"
    )
    assert relationships.status_code == 200
    assert relationships.json()["reviews"][0]["id"] == review_id
    assert relationships.json()["crs_sheets"][0]["id"] == sheet_id


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
