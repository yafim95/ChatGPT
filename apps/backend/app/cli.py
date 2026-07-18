"""Command-line entry point used by development and the packaged sidecar."""

from __future__ import annotations

import argparse
import ipaddress
import os
from pathlib import Path

import uvicorn
from pydantic import SecretStr

from app.core.config import AppConfig, Environment
from app.main import create_app


def _loopback_host(value: str) -> str:
    if value == "localhost":
        return value
    try:
        address = ipaddress.ip_address(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("host must be a loopback IP address") from exc
    if not address.is_loopback:
        raise argparse.ArgumentTypeError("ProjectMind may only bind to a loopback address")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="ProjectMind local backend")
    parser.add_argument("--host", type=_loopback_host, default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--data-dir", type=Path, default=None)
    parser.add_argument(
        "--environment",
        choices=[item.value for item in Environment],
        default=os.getenv("PROJECTMIND_ENVIRONMENT", Environment.PRODUCTION.value),
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    environment = Environment(args.environment)
    session_token = os.getenv("PROJECTMIND_SESSION_TOKEN")
    if not session_token:
        raise SystemExit("PROJECTMIND_SESSION_TOKEN is required")

    if args.data_dir is None:
        config = AppConfig(
            host=args.host,
            port=args.port,
            environment=environment,
            session_token=SecretStr(session_token),
        )
    else:
        config = AppConfig(
            host=args.host,
            port=args.port,
            environment=environment,
            session_token=SecretStr(session_token),
            data_dir=args.data_dir,
        )
    uvicorn.run(
        create_app(config),
        host=config.host,
        port=config.port,
        access_log=False,
        log_config=None,
        server_header=False,
    )
