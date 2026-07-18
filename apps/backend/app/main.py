"""FastAPI application factory for the local ProjectMind sidecar."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import Response

from app.api.router import router
from app.core.config import AppConfig
from app.core.errors import ProjectMindError
from app.core.logging import configure_logging
from app.core.security import has_valid_session
from app.database.migrations import run_migrations
from app.database.session import Database

logger = logging.getLogger(__name__)


def _error_payload(
    *,
    code: str,
    message: str,
    trace_id: str,
    details: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or [],
            "trace_id": trace_id,
        }
    }


def create_app(settings: AppConfig | None = None) -> FastAPI:
    config = settings or AppConfig()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        config.prepare_directories()
        token = config.session_token.get_secret_value()
        configure_logging(config.data_dir / "logs", config.log_level, (token,))
        await asyncio.to_thread(run_migrations, config)
        database = Database(config)
        app.state.database = database
        logger.info("ProjectMind backend started on loopback port %s", config.port)
        try:
            yield
        finally:
            await database.close()
            logger.info("ProjectMind backend stopped")

    app = FastAPI(
        title=config.app_name,
        version=config.app_version,
        lifespan=lifespan,
        docs_url="/docs" if config.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if config.docs_enabled else None,
    )
    app.state.settings = config

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(config.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-ProjectMind-Session", "X-Request-ID"],
    )
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["127.0.0.1", "localhost", "[::1]", "testserver"],
    )

    @app.middleware("http")
    async def request_context(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        trace_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.trace_id = trace_id
        if request.url.path.startswith("/api/") and request.method != "OPTIONS":
            expected = config.session_token.get_secret_value()
            if not has_valid_session(request, expected):
                return JSONResponse(
                    status_code=401,
                    content=_error_payload(
                        code="unauthorized",
                        message="A valid application session is required.",
                        trace_id=trace_id,
                    ),
                    headers={
                        "X-Request-ID": trace_id,
                        "Cache-Control": "no-store",
                    },
                )
        response = await call_next(request)
        response.headers["X-Request-ID"] = trace_id
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(ProjectMindError)
    async def projectmind_error(request: Request, exc: ProjectMindError) -> JSONResponse:
        trace_id = getattr(request.state, "trace_id", str(uuid4()))
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(
                code=exc.code,
                message=exc.message,
                trace_id=trace_id,
                details=exc.details,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        trace_id = getattr(request.state, "trace_id", str(uuid4()))
        details = [
            {
                "field": ".".join(str(part) for part in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_error_payload(
                code="validation_error",
                message="The request contains invalid data.",
                trace_id=trace_id,
                details=details,
            ),
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        trace_id = getattr(request.state, "trace_id", str(uuid4()))
        logger.exception("Unhandled request failure trace_id=%s", trace_id, exc_info=exc)
        return JSONResponse(
            status_code=500,
            content=_error_payload(
                code="internal_error",
                message="An unexpected local service error occurred.",
                trace_id=trace_id,
            ),
        )

    app.include_router(router)
    return app
