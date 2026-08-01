# Implementation plan

## Assumptions

- The initial deployment is a trusted, single-user Windows workstation. Multi-user authentication and shared-server synchronization require a separate deployment architecture.
- English is the first interface language; data contracts and future indexing are Unicode-safe for Arabic.
- `ProjectMind Engineering AI` is the default brand, not a hard-coded product identity. The user can change the visible name.
- External AI is opt-in. Kimi/OpenAI-compatible credentials are protected for the current Windows user with DPAPI, outside SQLite and logs.
- Provider model identifiers and request parameters are checked against official provider documentation and isolated in one adapter.
- An NSIS package is the initial installer. Code signing credentials are a release-management input and are not stored in this repository.

## Key technical risks

| Risk | Impact | Mitigation / validation gate |
|---|---|---|
| Python/OCR/ML sidecar size and antivirus false positives | Slow installs or blocked execution | Reproducible PyInstaller build, signed releases, Windows Defender test, lazy optional model download |
| BGE-M3 resource use on office PCs | Poor responsiveness | Hardware probe, quantized/lighter model profiles, background indexing, published benchmarks |
| Accurate PDF/drawing citations | Incorrect engineering evidence | Preserve page coordinates and extraction lineage; synthetic golden-document tests before chat |
| Spreadsheet and table structure loss | Wrong comparisons | Cell/range-aware parsers and typed numerical extraction tests |
| Revision/precedence mistakes | Superseded requirements used | Explicit user confirmation, immutable version links, conflict display, impact analysis |
| SQLite writer contention during ingestion | Failed or slow jobs | WAL, short transactions, one write coordinator, resumable jobs, measured load tests |
| Localhost API probing | Local data exposure | Random token, loopback-only binding, restrictive CORS/CSP, no secret in process arguments |
| External model API changes | Broken chat | Provider contract tests, model discovery, centralized adapter, connection test |
| Windows packaging drift | Installer failures | Pinned dependencies and a Windows CI packaging smoke test |

## Phases

### Phase 1 — Foundation (implemented)

- Repository standards and architecture records.
- Tauri desktop shell and Python sidecar lifecycle.
- SQLite/Alembic database foundation.
- Project CRUD and project defaults.
- Configurable application settings.
- Health, API security, audit, tests, and installer workflow.

Exit gate: migrations, backend tests, backend static checks, frontend tests, lint, typecheck, production web build, and Windows sidecar/Tauri build workflow.

### Phase 2 — Document library (usable baseline in 0.2.0)

- Controlled file repository and SHA-256 duplicate detection.
- PDF, DOCX, XLSX/XLSM, CSV, Markdown, and text extraction.
- Visible failures, bounded parsing, preview, missing-file detection, and revision links.
- Current/superseded records and synthetic parser tests.

Remaining: background job progress/cancellation, OCR fallback, richer metadata confirmation, and page-coordinate citations.

### Phase 3 — Search and retrieval (exact-search baseline in 0.2.0)

- SQLite FTS5 exact content/title search with Unicode tokenization.
- Current/superseded filtering and file/version/excerpt citations.
- Controlled evidence selection for chat and reviews.

Remaining: local embeddings, hybrid ranking, metadata filters, parent-child chunks, conflict candidates, and a measured retrieval benchmark corpus. LanceDB remains an option, not an implemented dependency.

### Phase 4 — Kimi chat (usable baseline in 0.2.0)

- Verified Kimi K3/OpenAI-compatible provider adapter and Windows DPAPI-protected key.
- Configurable timeout, output budget, K3 reasoning effort, context assembly, connection test, and controlled provider errors.
- Evidence-only, project, and general modes with local-only degradation when evidence is absent.
- Saved conversations with complete provider assistant messages for valid K3 multi-turn reasoning.

Remaining: streaming, cancellation, structured outputs, tool calls, retry policy, and usage/cost accounting.

### Phase 5 — Engineering workflows (draft-review baseline in 0.2.0)

- Source-linked draft reviews for material submittals, method statements/MSRAs, ITPs, shop drawings, technical reports, and general engineering documents.
- Saved local review history and reusable instruction prompts.

Remaining: controlled-memory approval/versioning, requirements, comparisons, issues, decisions, calculations, richer templates, and DOCX/Markdown export.

### Phase 6 — Hardening and release (in progress)

- Implemented: automatic/manual local database backups, rotating/sanitized diagnostics, renderer watchdog and recovery, installer build, upgrade-preserving data directory, and automated Windows smoke workflow.
- Remaining: guided restore, encryption option, performance/accessibility benchmarks, code signing, broad upgrade/uninstall matrices, and final user documentation.

## Definition of done for every phase

- The repository is runnable and migrations upgrade existing data.
- User-visible controls are functional; unfinished functionality is absent.
- Automated tests cover new behavior and failure paths.
- Privacy and audit effects are documented.
- Setup, packaging, and recovery instructions are current.
- Engineering-impacting output remains clearly subject to qualified professional review.
