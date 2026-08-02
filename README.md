# ProjectMind Engineering AI

ProjectMind is a Windows-first engineering knowledge and document-intelligence application. It is designed to become a traceable, revision-aware project memory for construction teams rather than a general chatbot.

Version 0.3.0 turns that foundation into a connected local-first engineering document-control workspace:

- A new Claymorphism/Glassmorphism application shell with a project command center, persistent navigation, responsive work surfaces, and comfortable/compact density controls.
- Bundled FastAPI sidecar architecture; end users will not need Python.
- Authenticated localhost communication with a random per-launch session token.
- Project creation, editing, archiving, native local-folder selection, and an in-app browser for the real project directory without moving source files.
- Local PDF, DOCX, XLSX/XLSM, CSV, Markdown, and text extraction with SHA-256 duplicate and revision tracking.
- A document register with open/closed review state, configurable decision codes, permanent-memory classification, indexed preview, and direct links to related chats, reviews, and Comment Reply Sheets.
- ChatGPT Work-style project conversations with explicit file selection, reusable chats, evidence citations, and a visible controlled-context rail.
- Three-tier RAG: selected review files first, relevant permanent project-memory passages second, and project-wide FTS5 passage retrieval third.
- Formal document reviews for submittals, MSRAs, ITPs, shop drawings, and reports, including due dates, discipline/reference fields, decision codes, revision reopening, and linked AI drafts.
- Attached Comment Reply Sheets (CRS) with consultant comments, contractor replies, consultant responses, row closure, review relationships, and CSV export.
- A dedicated Project memory manager, an in-app six-step workflow guide, and modular project/application controls for appearance, retrieval, documents, privacy, provider credentials, backups, diagnostics, and interface recovery.
- SQLite with WAL, foreign keys, Alembic migrations, soft-deletion, audit events, and automatic/manual backups.
- Automated backend/frontend checks and a Windows NSIS installer workflow.

Source documents stay in their selected folders. Extracted text, search indexes, project records, conversations, and reviews are stored locally. External AI is disabled by default; when enabled, ProjectMind sends the prompt and selected retrieved excerpts rather than uploading the document library.

OCR, vector/embedding reranking, structured requirement registers, formatted DOCX/XLSX review exports, signed release distribution, and enterprise encryption remain roadmap work. Image-only PDFs are reported as needing OCR instead of being presented as successfully searchable.

## Architecture at a glance

```mermaid
flowchart LR
    UI["Tauri + React desktop"] -->|"localhost + launch token"| API["FastAPI sidecar"]
    API --> DB["SQLite + Alembic"]
    API --> FS["Local project files"]
    API --> IDX["SQLite FTS5"]
    API -. "opt-in selected evidence" .-> KIMI["Kimi / compatible provider"]
```

See the [User workflow](docs/WORKFLOW.md), [Architecture](docs/ARCHITECTURE.md), [Implementation plan](docs/IMPLEMENTATION_PLAN.md), and historical [Phase 1 verification](docs/PHASE_1.md) for operation, decisions, current limits, and roadmap.

## Developer quick start on Windows

Prerequisites are required **only for developers**:

- Windows 10/11 x64
- Python 3.12 x64
- Node.js 22 or later
- Rust stable with the MSVC target
- Microsoft C++ Build Tools and WebView2

From PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
./scripts/dev.ps1
```

The script creates an isolated Python environment, installs pinned dependencies, starts the authenticated local backend, and opens Tauri in development mode.

## Run checks

```powershell
./scripts/verify.ps1
```

Individual backend checks:

```powershell
cd apps/backend
py -3.12 -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements-dev.lock
./.venv/Scripts/python.exe -m pytest
./.venv/Scripts/python.exe -m ruff check .
./.venv/Scripts/python.exe -m mypy app
```

Individual frontend checks:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Create the Windows installer

```powershell
./scripts/build-windows.ps1
```

The build process packages the Python backend with PyInstaller, gives the executable the target-specific name required by Tauri, builds the React application, and produces an NSIS installer under `apps/desktop/src-tauri/target/release/bundle/nsis`.

Application databases and project files live under the user's local application-data folder and are not stored in the installation directory. Normal application upgrades therefore preserve project data.

## Local API development

The backend is not intended to be exposed on a network. For API-only development:

```powershell
$env:PROJECTMIND_ENVIRONMENT = "development"
$env:PROJECTMIND_SESSION_TOKEN = "local-development-token"
cd apps/backend
./.venv/Scripts/python.exe -m app --port 8765
```

Use `X-ProjectMind-Session: local-development-token` for `/api/*` requests. `/health/live` is the only unauthenticated endpoint and reveals no project data. API documentation is available in development only at `/docs`.

## Product safety

ProjectMind assists qualified professionals; it does not replace engineering judgment, contractual review, or authority approval. AI-generated conclusions that could affect safety, construction, cost, design, or compliance must remain evidence-linked and subject to qualified review.

## Status

Version `0.3.0` — connected EDMS-style project workspace, persistent project memory, controlled RAG, document review register, and Comment Reply Sheets. See [CHANGELOG.md](CHANGELOG.md).
