# Changelog

All notable changes are documented here. The project follows semantic versioning once the first stable release is published.

## 0.3.0 — 2026-08-01

### Added

- Replace the project workspace with a connected EDMS/project-management interface using a restrained Claymorphism and Glassmorphism visual system, a project command center, persistent project navigation, responsive layouts, and configurable density/motion.
- Add a real project-directory browser with folders, recursive name/path search, native Explorer access, supported-format visibility, safe folder-boundary enforcement, configurable exclusions, and indexed-state indicators.
- Add a document workflow inspector for permanent project memory, memory category, open/closed review state, Code 1/2/3 decisions, indexed preview, and related chats/reviews/CRS records.
- Add a ChatGPT Work-style AI workspace with saved project chats, explicit review-file selection, a controlled-context rail, project memory controls, prompt shortcuts, and source-tier citations.
- Add chunked local FTS5 retrieval and a three-tier RAG pipeline: selected documents, permanent project memory, then project-wide evidence, with de-duplication and a configurable context budget.
- Persist conversation-to-document relationships so every indexed file can show the chats that used it as selected context, memory, or retrieved evidence.
- Add a formal review register with file attachment, review type, discipline, reference, due date, manual/AI drafting, configurable decision codes, open/closed state, and automatic reopening when a new document revision is indexed.
- Add Comment Reply Sheets linked to documents and reviews, including consultant comments, contractor replies, consultant responses, row status, automatic sheet status, CSV export, and duplicate/mismatched-link safeguards.
- Add a dedicated Project memory page for contracts, Employer Requirements, specifications, IFC drawings, authority requirements, and durable project-specific AI rules.
- Add an in-app six-step usage guide and expanded application/project controls for appearance, document handling, RAG passage sizing, retrieval budgets, history, default folders, automatic memory, CRS defaults, review due dates, and exclusions.
- Add the `20260801_0003` data migration with v0.2 document-chunk backfill and upgrade coverage that preserves existing projects, documents, and configured review codes.

### Changed

- Default review codes now match the requested consultant workflow: Code 1 Approved; Code 2 Revise and resubmit—work may proceed; Code 3 Revise and resubmit—work may not proceed. Existing customized code sets are preserved.
- Document scanning now respects per-project exclusion patterns and carries permanent-memory classification into new revisions while reopening previously closed documents for reassessment.
- External AI receives bounded, relevant extracted passages instead of the full library; selected review files always receive retrieval priority.
- Use a fresh `webview-v0.3.0` renderer profile while preserving the application database, projects, source-folder links, indexed records, chats, reviews, and CRS data.

### Safety and limits

- Project files, extracted text, chunks, relationships, reviews, and CRS records remain local. External AI is opt-in and receives retrieved passages only when the user initiates a chat or AI review.
- Retrieval is deterministic chunked FTS5 rather than embeddings in this release. This keeps the package local and lightweight; vector reranking remains a measured future enhancement rather than an unverified dependency.
- AI output remains evidence-linked assistance and requires qualified engineering, contractual, and authority review.

## 0.2.0 — 2026-08-01

### Added

- Replace the single-purpose project page with a polished persistent application shell, Home dashboard, project list, workspace breadcrumbs, back navigation, and dedicated Documents, Ask Project, Reviews, and Project Settings sections.
- Add separate active/archived portfolio views and project restoration so archiving is reversible from the UI.
- Select a local project folder through a native Windows folder picker, scan it manually or on project open, and reveal source files in File Explorer.
- Extract searchable text from PDF, DOCX, XLSX/XLSM, CSV, Markdown, and text files while leaving originals untouched.
- Track SHA-256 duplicates, file revisions, current/superseded versions, missing files, extraction failures, and image-only files that need OCR.
- Add SQLite FTS5 content search, document previews, exact evidence excerpts, and optional historical-version search.
- Add evidence-only, project, and general chat modes with saved local conversation history and source-linked responses.
- Add draft engineering review workflows for material submittals, method statements/MSRAs, ITPs, shop drawings, technical reports, and general reviews.
- Add a configurable Kimi/OpenAI-compatible provider adapter, Windows DPAPI-protected API-key storage, connection testing, K3 reasoning-effort control, timeouts, and output limits.
- Add modular settings for appearance, startup, retrieval, privacy, automatic/manual backups, diagnostic logging, storage locations, and safe WebView recovery.
- Add pre-migration safety copies, dashboard/project summaries, migration coverage, provider-contract tests, knowledge-workflow tests, and persistent-navigation UI coverage.

### Changed

- Use the current official `kimi-k3` Chat Completions contract: omit fixed sampling parameters, send `reasoning_effort`, and preserve complete assistant messages for valid multi-turn reasoning.
- Use a fresh `webview-v0.2.0` renderer profile while preserving the application database, indexed records, projects, and selected source folders.
- Rename the workflow from Phase 1 CI to ProjectMind CI and make the packaged Windows smoke test verify project creation, document scanning, FTS search, and backup creation in addition to startup.

### Safety and limits

- External AI remains disabled by default. Local scanning, indexing, search, preview, settings, and backups do not require it.
- ProjectMind sends only the current prompt, project identity, selected retrieved excerpts, and limited conversation context when external AI is enabled; it does not upload the project folder.
- OCR, vector retrieval, structured controlled memory, document export, and release signing remain future work and are not represented as completed controls.

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
