from httpx import AsyncClient


async def test_liveness_is_public_and_minimal(client: AsyncClient) -> None:
    response = await client.get("/health/live", headers={"X-ProjectMind-Session": ""})

    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


async def test_authenticated_health_checks_database(client: AsyncClient) -> None:
    response = await client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "ok"
    assert payload["version"] == "0.1.3"
    assert payload["environment"] == "test"
