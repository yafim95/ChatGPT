# Phase 1 — Foundation

> Historical verification record for version 0.1.0. The current 0.2.0 product also includes the usable document, exact-search, Kimi chat, draft-review, backup, and modular-settings baselines described in the implementation plan.

## Objective

Deliver a runnable Windows desktop foundation that can create and manage project workspaces safely, persist settings, monitor its local backend, migrate data, and progress to document ingestion without replacing the architecture.

## Implemented files and behavior

- `apps/desktop`: professional React/Fluent UI project and settings screens, health state, and Tauri bootstrap.
- `apps/desktop/src-tauri`: sidecar launch, random session token, dynamic port, local data directory, CSP, and NSIS configuration.
- `apps/backend`: authenticated FastAPI API, SQLAlchemy models/services, Alembic migration, logging, audit, and tests.
- `scripts`: repeatable development, verification, backend packaging, and Windows installer commands.
- `.github/workflows/ci.yml`: Linux quality checks and Windows packaging smoke test.

## Verification matrix

| Requirement | Automated evidence |
|---|---|
| Liveness does not expose data | `test_health.py` |
| API rejects missing/incorrect launch token | `test_security.py` |
| Project create/list/update/archive works | `test_projects.py` |
| Duplicate project numbers return a controlled conflict | `test_projects.py` |
| App settings persist and validate | `test_settings.py` |
| Initial migration creates required Phase 1 tables | `test_migrations.py` |
| Frontend API error normalization | `client.test.ts` |
| Project presentation and status | `ProjectCard.test.tsx` |
| Strict TypeScript and production web bundle | `npm run typecheck`, `npm run build` |
| Bundled backend contains migrations and starts successfully | PyInstaller sidecar smoke test |

## Run

```powershell
./scripts/dev.ps1
```

## Verify

```powershell
./scripts/verify.ps1
```

## Build installer

```powershell
./scripts/build-windows.ps1
```

The build output is an NSIS setup executable. The final-user machine does not require Python, Node.js, Rust, Docker, or a database server.

## Deferred by design in Phase 1

Version 0.1.0 did not import documents, index text, call an AI provider, or claim that an installer had been release-signed. Version 0.2.0 implements the first three as controlled working baselines; release signing remains a release-management gate.
