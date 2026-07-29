# Changelog

All notable changes are documented here. The project follows semantic versioning once the first stable release is published.

## 0.1.4 — 2026-07-28

### Fixed

- Package the production interface as one self-contained HTML asset so Windows endpoint controls, custom-protocol asset resolution, or a failed secondary asset request cannot leave the WebView empty.
- Render a useful startup surface directly in `index.html`, before React or the application bundle executes.
- Add a native startup watchdog that replaces an unmounted renderer with a recovery screen instead of allowing a blank window.
- Make the installed-Windows smoke test accept only launch-scoped renderer evidence; stale success lines from an older process can no longer pass the test.

### Added

- Record a unique renderer launch ID, native page-load events, WebView runtime version, document-start errors, mount evidence, and visible-interface dimensions in `desktop.log`.
- Validate that the rendered surface has useful text and non-zero visible dimensions before declaring the application ready.
- Provide recovery actions to reload the interface, clear only WebView browsing data, and open the diagnostics directory. Project databases and local documents are never cleared by these actions.
- Rotate oversized desktop logs while retaining the immediately previous log.
- Preserve installed-application smoke-test logs with the Windows CI artifact for failed-launch diagnosis.

### Changed

- Target ES2020 and relative asset paths for broader WebView2 compatibility.
- Use a new `webview-v0.1.4` renderer profile while leaving the SQLite data directory and all project rows untouched.

## 0.1.3 — 2026-07-26

### Fixed

- Start the Windows interface with a fresh, versioned WebView profile so a stale or damaged renderer cache cannot leave the application blank after an upgrade.
- Catch React render failures and show a recoverable local diagnostic screen instead of an empty window.
- Record sanitized frontend exceptions and rejected promises in `desktop.log`.

### Changed

- Mark the frontend ready only after application settings and the initial project view have rendered.
- Require the installed-Windows smoke test to observe the complete interface-rendered marker rather than only a successful backend connection.

## 0.1.2 — 2026-07-26

### Fixed

- Complete an interrupted initial SQLite migration without deleting existing tables or rows.
- Commit SQLite setup before Alembic runs so the recorded schema revision persists.
- Preserve migration and startup exceptions in `application.log`.
- Treat informational backend `stderr` output as diagnostics rather than a startup error.
- Report backend termination as the actionable failure instead of retaining an earlier informational line.

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
