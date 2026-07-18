# Windows installer workflow

Phase 1 targets the Tauri NSIS bundler.

1. `scripts/build-backend.ps1` creates a self-contained PyInstaller sidecar.
2. The script appends Rust's Windows target triple, as required by Tauri external binaries.
3. `scripts/build-windows.ps1` runs quality checks and `tauri build`.
4. The installer is emitted under `apps/desktop/src-tauri/target/release/bundle/nsis`.

Project data is written below Windows local application data, outside the installation directory. Normal NSIS upgrades and uninstallation therefore do not erase project databases. A branded, explicit data-removal choice and code-signing pipeline are Phase 6 release gates.
