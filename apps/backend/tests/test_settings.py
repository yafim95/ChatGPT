from httpx import AsyncClient


async def test_application_settings_can_be_read_and_updated(client: AsyncClient) -> None:
    initial = await client.get("/api/settings")
    assert initial.status_code == 200
    assert initial.json()["brand_name"] == "ProjectMind Engineering AI"
    assert initial.json()["telemetry_enabled"] is False
    assert initial.json()["ai_model"] == "kimi-k3"
    assert initial.json()["ai_reasoning_effort"] == "high"
    assert initial.json()["ai_max_output_tokens"] == 16000
    assert initial.json()["start_view"] == "last"

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


async def test_nullable_default_project_root_can_be_cleared(client: AsyncClient) -> None:
    configured = await client.patch(
        "/api/settings",
        json={"default_project_root": "C:\\Projects"},
    )
    assert configured.status_code == 200
    assert configured.json()["default_project_root"] == "C:\\Projects"

    cleared = await client.patch(
        "/api/settings",
        json={"default_project_root": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["default_project_root"] is None


async def test_settings_validate_backup_interval(client: AsyncClient) -> None:
    response = await client.patch("/api/settings", json={"backup_interval_days": 0})

    assert response.status_code == 422


async def test_settings_reject_ineffective_passage_overlap(client: AsyncClient) -> None:
    response = await client.patch(
        "/api/settings",
        json={"rag_chunk_size": 1000, "rag_chunk_overlap": 700},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "invalid_retrieval_settings"


async def test_remote_provider_requires_https_but_loopback_http_is_allowed(
    client: AsyncClient,
) -> None:
    insecure_remote = await client.patch(
        "/api/settings",
        json={"ai_base_url": "http://provider.example/v1"},
    )
    local_provider = await client.patch(
        "/api/settings",
        json={"ai_base_url": "http://127.0.0.1:11434/v1"},
    )

    assert insecure_remote.status_code == 422
    assert local_provider.status_code == 200
