from httpx import AsyncClient


async def test_application_settings_can_be_read_and_updated(client: AsyncClient) -> None:
    initial = await client.get("/api/settings")
    assert initial.status_code == 200
    assert initial.json()["brand_name"] == "ProjectMind Engineering AI"
    assert initial.json()["telemetry_enabled"] is False

    updated = await client.patch(
        "/api/settings",
        json={
            "brand_name": "Consultant Project Intelligence",
            "theme": "dark",
            "backup_interval_days": 3,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["brand_name"] == "Consultant Project Intelligence"
    assert updated.json()["theme"] == "dark"
    assert updated.json()["backup_interval_days"] == 3

    persisted = await client.get("/api/settings")
    assert persisted.json()["brand_name"] == "Consultant Project Intelligence"


async def test_settings_validate_backup_interval(client: AsyncClient) -> None:
    response = await client.patch("/api/settings", json={"backup_interval_days": 0})

    assert response.status_code == 422
