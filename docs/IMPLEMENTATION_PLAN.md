# Implementation plan

## Assumptions

- The initial deployment is a trusted, single-user Windows workstation. Multi-user authentication and shared-server synchronization require a separate deployment architecture.
- English is the first interface language; data contracts and future indexing are Unicode-safe for Arabic.
- `ProjectMind Engineering AI` is the default brand, not a hard-coded product identity. Phase 1 allows the user to change the visible name.
- The current phase does not call Kimi and stores no external API key.
- The future Kimi model identifier and endpoint will be verified against the provider's official API before Phase 4 instead of relying permanently on a prompt-time string.
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

### Phase 2 — Document library

- Controlled file repository and SHA-256 duplicate detection.
- PDF, DOCX, and XLSX extraction; OCR fallback.
- Metadata confirmation, ingestion jobs, failures, viewer, and revision links.
- Current/superseded confirmation and synthetic parser tests.

### Phase 3 — Search and retrieval

- FTS5 and local embedding providers.
- LanceDB implementation behind an interface.
- Hybrid ranking, metadata filters, parent-child chunks, citations, and conflict candidates.
- Benchmark corpus and retrieval/citation quality tests.

### Phase 4 — Kimi chat

- Verified Kimi provider adapter and Windows-protected API key.
- Streaming, token budgets, context assembly, tool calls, structured outputs, retries, and usage accounting.
- Evidence-only/project-only/all-sources modes and offline degradation.

### Phase 5 — Controlled memory and engineering workflows

- Memory approval/versioning and conflict review.
- Requirements, reviews, comparisons, issues, decisions, calculations, and templates.
- Material, method-statement, ITP, drawing, and report workflows with evidence per comment.
- DOCX/Markdown export.

### Phase 6 — Hardening and release

- Backup/restore, encryption option, performance/accessibility testing, signing, upgrade/uninstall tests, user documentation, and release installer.

## Definition of done for every phase

- The repository is runnable and migrations upgrade existing data.
- User-visible controls are functional; unfinished functionality is absent.
- Automated tests cover new behavior and failure paths.
- Privacy and audit effects are documented.
- Setup, packaging, and recovery instructions are current.
- Engineering-impacting output remains clearly subject to qualified professional review.
