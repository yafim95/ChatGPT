from __future__ import annotations

from app.models.settings import ApplicationSettings
from app.services.provider import ProviderClient


def _settings(model: str, provider: str = "moonshot") -> ApplicationSettings:
    return ApplicationSettings(
        ai_provider=provider,
        ai_base_url="https://api.moonshot.ai/v1",
        ai_model=model,
        ai_reasoning_effort="high",
        ai_max_output_tokens=8000,
    )


def test_kimi_k3_payload_uses_supported_reasoning_parameters() -> None:
    payload = ProviderClient.completion_payload(
        _settings("kimi-k3"),
        [{"role": "user", "content": "Review this requirement."}],
    )

    assert payload["reasoning_effort"] == "high"
    assert payload["max_completion_tokens"] == 8000
    assert "temperature" not in payload
    assert "max_tokens" not in payload


def test_compatible_provider_payload_uses_conventional_parameters() -> None:
    payload = ProviderClient.completion_payload(
        _settings("compatible-engineering-model", "openai_compatible"),
        [{"role": "user", "content": "Review this requirement."}],
    )

    assert payload["temperature"] == 0.2
    assert payload["max_tokens"] == 8000
    assert "reasoning_effort" not in payload
    assert "max_completion_tokens" not in payload
