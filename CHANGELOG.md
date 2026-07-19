# Changelog

All notable changes are documented here. The project follows semantic versioning once the first stable release is published.

## 0.1.1 — 2026-07-19

### Fixed

- Restart the packaged backend when recovery is requested instead of repeating a failed HTTP call.
- Preserve local desktop-side diagnostics for sidecar launch, stderr, and termination events.
- Capture backend failures that occur before the ASGI lifespan starts.
- Allow additional startup time for PyInstaller one-file extraction and endpoint protection scans.

### Changed

- Add direct packaged-backend and installed-desktop runtime smoke tests to the Windows build.
- Show the local diagnostic log path and sanitized process failure on the recovery screen.

## 0.1.0 — 2026-07-18

### Added

- Phase 1 Tauri/React desktop foundation.
- Authenticated FastAPI sidecar and health monitoring.
- SQLite/Alembic persistence with project, settings, and audit entities.
- Project creation, update, listing, and soft archive.
- Configurable branding, theme, locale, and backup preferences.
- Backend and frontend automated tests and static checks.
- PyInstaller sidecar and NSIS installer development workflow.
- Architecture, security, phase, and implementation documentation.
