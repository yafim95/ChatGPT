"""Loopback API session authentication."""

from __future__ import annotations

import hmac

from starlette.requests import Request

SESSION_HEADER = "X-ProjectMind-Session"


def has_valid_session(request: Request, expected_token: str) -> bool:
    supplied = request.headers.get(SESSION_HEADER, "")
    return bool(supplied) and hmac.compare_digest(supplied, expected_token)
