"""Windows user-scoped secret storage for the external AI provider key."""

from __future__ import annotations

import base64
import os
import subprocess
from contextlib import suppress
from pathlib import Path

from app.core.config import Environment
from app.core.errors import ConfigurationError

_ENV_KEY = "PROJECTMIND_KIMI_API_KEY"


class SecretStore:
    """Store the provider key with Windows DPAPI and never place it in SQLite."""

    def __init__(self, data_dir: Path, environment: Environment) -> None:
        self._path = data_dir / "secrets" / "provider-key.dpapi"
        self._environment = environment
        self._test_value: str | None = None
        self._cached_value: str | None = None
        self._loaded = False

    def configured(self) -> bool:
        if os.getenv(_ENV_KEY, "").strip():
            return True
        if self._environment is Environment.TEST:
            return self._test_value is not None
        if os.name != "nt":
            return False
        try:
            return self._path.is_file() and self._path.stat().st_size > 0
        except OSError:
            return False

    def get(self) -> str | None:
        environment_value = os.getenv(_ENV_KEY, "").strip()
        if environment_value:
            return environment_value
        if self._environment is Environment.TEST:
            return self._test_value
        if self._loaded:
            return self._cached_value
        if os.name != "nt" or not self._path.is_file():
            self._loaded = True
            return None
        try:
            encrypted = self._path.read_text(encoding="ascii").strip()
        except (OSError, UnicodeError) as exc:
            raise ConfigurationError(
                "The saved AI provider key could not be read. Remove it and save it again.",
                code="secret_unavailable",
            ) from exc
        if not encrypted:
            self._loaded = True
            self._cached_value = None
            return None
        script = (
            "Add-Type -AssemblyName System.Security;"
            "$encrypted=[Convert]::FromBase64String([Console]::In.ReadToEnd());"
            "$plain=[Security.Cryptography.ProtectedData]::Unprotect("
            "$encrypted,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);"
            "[Console]::Out.Write([Convert]::ToBase64String($plain))"
        )
        encoded_plaintext = self._run_powershell(script, encrypted)
        try:
            self._cached_value = base64.b64decode(encoded_plaintext, validate=True).decode("utf-8")
            self._loaded = True
            return self._cached_value
        except (ValueError, UnicodeDecodeError) as exc:
            raise ConfigurationError(
                "The saved AI provider key could not be decrypted. Remove it and save it again.",
                code="secret_unavailable",
            ) from exc

    def set(self, value: str) -> None:
        key = value.strip()
        if len(key) < 8:
            raise ConfigurationError(
                "Enter a valid AI provider API key.",
                code="invalid_provider_key",
            )
        if self._environment is Environment.TEST:
            self._test_value = key
            return
        if os.name != "nt":
            raise ConfigurationError(
                "Secure provider-key storage is available in the Windows desktop application.",
                code="secret_storage_unavailable",
            )
        script = (
            "Add-Type -AssemblyName System.Security;"
            "$plain=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());"
            "$encrypted=[Security.Cryptography.ProtectedData]::Protect("
            "$plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);"
            "[Console]::Out.Write([Convert]::ToBase64String($encrypted))"
        )
        encrypted = self._run_powershell(script, key)
        temporary_path = self._path.with_suffix(".tmp")
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            temporary_path.write_text(encrypted, encoding="ascii")
            temporary_path.chmod(0o600)
            temporary_path.replace(self._path)
        except OSError as exc:
            raise ConfigurationError(
                "Windows could not save the protected AI provider key.",
                code="secret_storage_unavailable",
            ) from exc
        finally:
            with suppress(OSError):
                temporary_path.unlink(missing_ok=True)
        self._cached_value = key
        self._loaded = True

    def remove(self) -> None:
        try:
            self._path.unlink(missing_ok=True)
        except OSError as exc:
            raise ConfigurationError(
                "Windows could not remove the protected AI provider key.",
                code="secret_storage_unavailable",
            ) from exc
        self._test_value = None
        self._cached_value = None
        self._loaded = True

    @staticmethod
    def _run_powershell(script: str, input_value: str) -> str:
        powershell = (
            Path(os.environ.get("SystemRoot", "C:/Windows"))
            / "System32"
            / "WindowsPowerShell"
            / "v1.0"
            / "powershell.exe"
        )
        try:
            result = subprocess.run(  # noqa: S603
                [
                    str(powershell),
                    "-NoLogo",
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    script,
                ],
                input=input_value,
                capture_output=True,
                text=True,
                check=True,
                timeout=15,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except (OSError, subprocess.SubprocessError) as exc:
            raise ConfigurationError(
                "Windows could not access the protected AI provider key.",
                code="secret_storage_unavailable",
            ) from exc
        output = result.stdout.strip()
        if not output:
            raise ConfigurationError(
                "Windows returned an empty protected-key result.",
                code="secret_storage_unavailable",
            )
        return output
