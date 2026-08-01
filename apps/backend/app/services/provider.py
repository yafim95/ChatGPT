from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.errors import ExternalServiceError
from app.models.settings import ApplicationSettings


@dataclass(frozen=True)
class ProviderCompletion:
    content: str
    message: dict[str, Any]


class ProviderClient:
    @staticmethod
    def _headers(api_key: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "ProjectMind-Engineering-AI/0.2.0",
        }

    async def test_connection(
        self,
        settings: ApplicationSettings,
        api_key: str,
    ) -> str:
        url = f"{settings.ai_base_url.rstrip('/')}/models"
        try:
            async with httpx.AsyncClient(
                timeout=float(settings.ai_timeout_seconds),
                follow_redirects=False,
            ) as client:
                response = await client.get(url, headers=self._headers(api_key))
        except httpx.TimeoutException as exc:
            raise ExternalServiceError(
                "The AI provider connection timed out. Check the endpoint and network.",
                code="provider_timeout",
            ) from exc
        except httpx.HTTPError as exc:
            raise ExternalServiceError(
                "The AI provider could not be reached. Check the endpoint and network.",
                code="provider_unreachable",
            ) from exc

        if response.status_code == 401:
            raise ExternalServiceError(
                "The AI provider rejected the API key.",
                code="provider_authentication_failed",
            )
        if response.status_code == 403:
            raise ExternalServiceError(
                "The AI provider denied access. Check the key, account access, and selected model.",
                code="provider_access_denied",
            )
        if 300 <= response.status_code < 400:
            raise ExternalServiceError(
                "The AI provider endpoint redirected the request. Save its final HTTPS base URL.",
                code="provider_redirected",
            )
        if response.status_code == 404:
            raise ExternalServiceError(
                "The AI provider models endpoint was not found. Check the saved base URL.",
                code="provider_endpoint_not_found",
            )
        if response.status_code >= 400:
            raise ExternalServiceError(
                f"The AI provider returned HTTP {response.status_code}.",
                code="provider_connection_failed",
            )
        return "Connection successful. The provider accepted the saved credentials."

    @staticmethod
    def completion_payload(
        settings: ApplicationSettings,
        messages: list[dict[str, Any]],
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": settings.ai_model,
            "messages": messages,
            "stream": False,
        }
        model_name = settings.ai_model.casefold()
        if model_name.startswith("kimi-k3"):
            payload["max_completion_tokens"] = settings.ai_max_output_tokens
            payload["reasoning_effort"] = settings.ai_reasoning_effort
        else:
            payload["max_tokens"] = settings.ai_max_output_tokens
            if not model_name.startswith("kimi-"):
                payload["temperature"] = 0.2
        return payload

    async def complete(
        self,
        settings: ApplicationSettings,
        api_key: str,
        messages: list[dict[str, Any]],
    ) -> ProviderCompletion:
        url = f"{settings.ai_base_url.rstrip('/')}/chat/completions"
        payload = self.completion_payload(settings, messages)
        try:
            async with httpx.AsyncClient(
                timeout=float(settings.ai_timeout_seconds),
                follow_redirects=False,
            ) as client:
                response = await client.post(
                    url,
                    headers=self._headers(api_key),
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise ExternalServiceError(
                "The AI request timed out. Retry or increase the provider timeout in Settings.",
                code="provider_timeout",
            ) from exc
        except httpx.HTTPError as exc:
            raise ExternalServiceError(
                "The AI provider could not be reached. Your indexed documents remain local.",
                code="provider_unreachable",
            ) from exc

        if response.status_code == 401:
            raise ExternalServiceError(
                "The AI provider rejected the saved API key.",
                code="provider_authentication_failed",
            )
        if response.status_code == 403:
            raise ExternalServiceError(
                "The AI provider denied access to this request. Check account and model access.",
                code="provider_access_denied",
            )
        if response.status_code == 429:
            raise ExternalServiceError(
                "The AI provider rate limit was reached. Wait briefly and retry.",
                code="provider_rate_limited",
            )
        if response.status_code in {408, 504}:
            raise ExternalServiceError(
                "The AI provider timed out while generating the answer. "
                "Retry or increase the timeout.",
                code="provider_timeout",
            )
        if 300 <= response.status_code < 400:
            raise ExternalServiceError(
                "The AI provider endpoint redirected the request. Save its final HTTPS base URL.",
                code="provider_redirected",
            )
        if response.status_code == 400:
            raise ExternalServiceError(
                "The AI provider rejected the request. Check the selected model and its settings.",
                code="provider_invalid_request",
            )
        if response.status_code == 404:
            raise ExternalServiceError(
                "The AI model or Chat Completions endpoint was not found. "
                "Check the model and base URL.",
                code="provider_model_not_found",
            )
        if response.status_code >= 500:
            raise ExternalServiceError(
                "The AI provider is temporarily unavailable. Retry shortly.",
                code="provider_unavailable",
            )
        if response.status_code >= 400:
            raise ExternalServiceError(
                f"The AI provider returned HTTP {response.status_code}.",
                code="provider_request_failed",
            )

        try:
            data = response.json()
            message = data["choices"][0]["message"]
            content = message["content"]
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ExternalServiceError(
                "The AI provider returned an unexpected response format.",
                code="provider_invalid_response",
            ) from exc
        if not isinstance(content, str) or not content.strip():
            raise ExternalServiceError(
                "The AI provider returned an empty response.",
                code="provider_empty_response",
            )
        if not isinstance(message, dict):
            raise ExternalServiceError(
                "The AI provider returned an invalid assistant message.",
                code="provider_invalid_response",
            )
        return ProviderCompletion(content=content.strip(), message=message)
