"""Central runtime configuration with secure defaults."""

from __future__ import annotations

from enum import StrEnum
from pathlib import Path

from platformdirs import user_data_path
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


def _default_data_dir() -> Path:
    return user_data_path("ProjectMind Engineering AI", "ProjectMind", ensure_exists=False)


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PROJECTMIND_",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "ProjectMind Engineering AI"
    app_version: str = "0.3.0"
    environment: Environment = Environment.PRODUCTION
    host: str = "127.0.0.1"
    port: int = Field(default=8765, ge=1, le=65535)
    session_token: SecretStr = Field(default=SecretStr(""), repr=False)
    data_dir: Path = Field(default_factory=_default_data_dir)
    database_filename: str = "projectmind.db"
    log_level: str = "INFO"
    enable_api_docs: bool | None = None

    @property
    def database_path(self) -> Path:
        return self.data_dir / self.database_filename

    @property
    def database_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.database_path.as_posix()}"

    @property
    def sync_database_url(self) -> str:
        return f"sqlite:///{self.database_path.as_posix()}"

    @property
    def docs_enabled(self) -> bool:
        if self.enable_api_docs is not None:
            return self.enable_api_docs
        return self.environment == Environment.DEVELOPMENT

    @property
    def allowed_origins(self) -> tuple[str, ...]:
        base = ("tauri://localhost", "http://tauri.localhost")
        if self.environment in {Environment.DEVELOPMENT, Environment.TEST}:
            return (*base, "http://localhost:1420", "http://127.0.0.1:1420")
        return base

    def prepare_directories(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "logs").mkdir(parents=True, exist_ok=True)
        (self.data_dir / "backups").mkdir(parents=True, exist_ok=True)
