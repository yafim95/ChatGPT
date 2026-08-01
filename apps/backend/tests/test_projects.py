from httpx import AsyncClient


def _project_payload(number: str = "SYNTH-001") -> dict[str, object]:
    return {
        "name": "Synthetic Project Alpha",
        "project_number": number,
        "client": "Synthetic Test Client",
        "consultant": "Synthetic Test Consultant",
        "contractor": "Synthetic Test Contractor",
    }


async def test_project_lifecycle(client: AsyncClient) -> None:
    created_response = await client.post("/api/projects", json=_project_payload())
    assert created_response.status_code == 201
    created = created_response.json()
    assert created["project_number"] == "SYNTH-001"
    assert created["settings"]["timezone"] == "Asia/Dubai"
    assert "Civil" in created["settings"]["disciplines"]
    assert created["settings"]["auto_scan_enabled"] is True

    list_response = await client.get("/api/projects")
    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert list_response.json()["items"][0]["id"] == created["id"]

    update_response = await client.patch(
        f"/api/projects/{created['id']}",
        json={"contractor": "Updated Contractor"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["contractor"] == "Updated Contractor"

    folder_response = await client.patch(
        f"/api/projects/{created['id']}/settings",
        json={"workspace_path": "C:\\Projects\\Synthetic"},
    )
    assert folder_response.status_code == 200
    assert folder_response.json()["settings"]["workspace_path"].endswith("Synthetic")
    cleared_folder = await client.patch(
        f"/api/projects/{created['id']}/settings",
        json={"workspace_path": None},
    )
    assert cleared_folder.status_code == 200
    assert cleared_folder.json()["settings"]["workspace_path"] is None

    controlled_defaults = await client.patch(
        f"/api/projects/{created['id']}/settings",
        json={
            "timezone": "UTC",
            "locale": "en-GB",
            "review_codes": [
                {"code": "A", "label": "Accepted"},
                {"code": "B", "label": "Revise and resubmit"},
            ],
        },
    )
    assert controlled_defaults.status_code == 200
    assert controlled_defaults.json()["settings"]["timezone"] == "UTC"
    assert controlled_defaults.json()["settings"]["review_codes"][1]["code"] == "B"

    duplicate_codes = await client.patch(
        f"/api/projects/{created['id']}/settings",
        json={
            "review_codes": [
                {"code": "A", "label": "Accepted"},
                {"code": "a", "label": "Another outcome"},
            ]
        },
    )
    assert duplicate_codes.status_code == 422

    archive_response = await client.delete(f"/api/projects/{created['id']}")
    assert archive_response.status_code == 204

    after_archive = await client.get("/api/projects")
    assert after_archive.json()["total"] == 0

    archived = await client.get("/api/projects", params={"status": "archived"})
    assert archived.status_code == 200
    assert archived.json()["total"] == 1
    assert archived.json()["items"][0]["status"] == "archived"

    missing = await client.get(f"/api/projects/{created['id']}")
    assert missing.status_code == 404

    restored = await client.post(f"/api/projects/{created['id']}/restore")
    assert restored.status_code == 200
    assert restored.json()["status"] == "active"

    active_again = await client.get("/api/projects")
    assert active_again.json()["total"] == 1


async def test_duplicate_project_number_is_a_controlled_conflict(client: AsyncClient) -> None:
    first = await client.post("/api/projects", json=_project_payload("abc-001"))
    second = await client.post("/api/projects", json=_project_payload("ABC-001"))

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "conflict"


async def test_unknown_fields_are_rejected(client: AsyncClient) -> None:
    payload = _project_payload()
    payload["api_key"] = "must-not-be-accepted"
    response = await client.post("/api/projects", json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
