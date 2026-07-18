from httpx import AsyncClient


async def test_api_rejects_missing_session_token(client: AsyncClient) -> None:
    response = await client.get("/api/projects", headers={"X-ProjectMind-Session": ""})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


async def test_api_rejects_incorrect_session_token(client: AsyncClient) -> None:
    response = await client.get(
        "/api/projects",
        headers={"X-ProjectMind-Session": "incorrect"},
    )

    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"
