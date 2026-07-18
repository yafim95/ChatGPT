# Security policy

## Supported version

The active development line is `0.1.x`. This repository is pre-release software and must not yet be used as the sole control for safety-critical or contractual decisions.

## Reporting a vulnerability

Do not open a public issue containing secrets, project documents, personal information, or exploit details. Contact the repository owner privately with:

- affected version and operating system;
- reproduction steps using synthetic data;
- expected and observed behavior;
- potential data exposure or integrity impact.

## Security baseline

- Never commit Kimi or other provider credentials.
- Never use confidential project documents as test fixtures.
- The backend must remain loopback-only.
- Release installers should be code-signed before organizational deployment.
- Treat generated engineering output as unapproved until a qualified professional verifies its cited evidence.

See `docs/ARCHITECTURE.md` for the runtime threat controls.
