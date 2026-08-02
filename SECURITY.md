# Security policy

## Supported version

The active development line is `0.3.x`. This repository is pre-release software and must not be used as the sole control for safety-critical or contractual decisions.

## Reporting a vulnerability

Do not open a public issue containing secrets, project documents, personal information, or exploit details. Contact the repository owner privately with:

- affected version and operating system;
- reproduction steps using synthetic data;
- expected and observed behavior;
- potential data exposure or integrity impact.

## Security baseline

- Never commit Kimi or other provider credentials.
- Provider keys must remain in current-user Windows DPAPI storage and out of SQLite, logs, source, and process arguments.
- Never use confidential project documents as test fixtures.
- The backend must remain loopback-only.
- External AI must remain opt-in, with selected retrieved excerpts rather than automatic project-library uploads.
- Release installers should be code-signed before organizational deployment.
- Treat generated engineering output as unapproved until a qualified professional verifies its cited evidence.

See `docs/ARCHITECTURE.md` for the runtime threat controls.
