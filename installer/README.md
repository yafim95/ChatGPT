# Windows installer workflow

ProjectMind uses the Tauri NSIS bundler for its Windows pre-release installer.

1. `scripts/build-backend.ps1` creates a self-contained PyInstaller sidecar.
2. The script appends Rust's Windows target triple, as required by Tauri external binaries.
3. `scripts/build-windows.ps1` runs quality checks and `tauri build`.
4. The installer is emitted under `apps/desktop/src-tauri/target/release/bundle/nsis`.

Project data is written below Windows local application data, outside the installation directory. Normal NSIS upgrades and uninstallation therefore do not erase project databases. Version 0.3.0 also makes a SQLite-consistent pre-migration backup before upgrading an older schema. A branded, explicit data-removal choice and code-signing pipeline remain release gates.
