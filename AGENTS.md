# Working in SnapSchool Web

## Start here

Read the [partner and engineering handbook](docs/handbook/README.md) for whole-project context. Read `README.md`, `docs/architecture.md` and `CONTRIBUTING.md`. For local setup, use `docs/getting-started.md`. These describe the current repository; `docs/archive/` contains historical material.

This repository is the Next.js web app and mobile API backend. The sibling `SnapSchool_Mobile` and `voice-agent` directories are separate projects. Check their own instructions before working there.

## Find the feature before editing

- Pages and route-local actions: `src/app/(dashboard)/`.
- Mobile API and authentication: `src/app/api/mobile/`.
- Shared UI: `src/components/`.
- Business rules, tenant authorization and integrations: `src/lib/`.
- Database schema and chronological migrations: `prisma/`.
- Python PDF worker: `api/student_pdf.py` and `services/student-pdf-import/`.
- Focused checks: `src/__tests__/`.

Trace the component's actual imports to identify the active implementation. Prefer route-local actions and focused domain modules over adding more unrelated behavior to `src/lib/crudActions.ts`. Do not move runtime modules wholesale without updating and verifying their callers.

## Preserve collaboration work

Inspect `git status` before editing. Existing modifications may belong to the user or another collaborator; do not revert, stage or commit unrelated changes. Keep commits focused and explain what changed, how it was checked, and what remains unverified.

## Data and authorization

Authenticate mutations and scope records to the server-owned school ID. Validate that referenced classes, students and parents belong to that school. Client IDs alone do not authorize access.

Student national identifiers are strings, including leading zeros. One parent account can have multiple children across classes. Parent access codes belong to parents, not children. Preserve existing personal passwords when preparing class slips.

Do not infer missing personal data, merge ambiguous guardians, or assign classes through fuzzy name matching. Use explicit review for conflicts. Keep multi-record imports transactional and verify saved records before commit.

Do not log passwords, paper codes, secrets, student PDFs or exported personal records. Do not commit private artifacts or put them in `public/`.

## Database operations

Generating Prisma Client does not apply migrations. Update the schema and add a chronological migration for schema changes. Verify the target environment and deployed schema before applying it.

Never run database resets, blanket schema pushes, seeds or historical repair scripts as an automatic setup step. Production actions must be within the user's authorized scope. Do not claim a database repair, deployment or live flow is verified based only on a code change.

## Checks

- `npm run typecheck`: TypeScript.
- `npm run lint`: lint.
- `npm run test:imports`: offline import, family, class-roster and parent-code checks.
- Other checks: inspect the relevant test and `scripts/README.md` before running. `npm test` is payroll-only; `test:all` includes integration/database operations.

Use checks appropriate to the change. Do not run live imports, activate accounts, send messages or generate real credentials just to test a UI without authorization. Respect session-specific instructions when the user prefers to perform live testing themselves.

## Historical tooling

`scripts/legacy/INDEX.md` maps old root filenames to their new locations. These tools are preserved reference material, not maintained application entry points. Many rewrite source files or change database contents; read them before considering use.

## Mandatory handoff maintenance — every change

The user requires this guide to stay current for the next agent. This applies to code, UI, tests, configuration, migrations, operational repairs and documentation changes.

Before starting, read:

1. This file and `docs/agents/README.md`.
2. `docs/agents/current-state.md` for implemented behavior, verified results and open issues.
3. The latest entries in `docs/agents/change-log.md`.
4. `docs/agents/feature-map.md` for the feature you will change.

For every logical change, before committing or handing work back:

- Update the relevant feature/state notes when behavior, paths, requirements or deployment status changes.
- Append a dated entry to `docs/agents/change-log.md`: what changed and why, affected paths, checks actually performed, database/deployment actions, remaining limitations and the next useful step.
- Update this file's **Latest handoff** below with the date and a short description/link. Every change must therefore include an `AGENTS.md` update, even when details live in the folder.
- Include handoff updates in the same commit as the implementation. For uncommitted work, describe its status explicitly; do not commit unrelated collaborators' files to satisfy this rule.
- Record failed or blocked operations accurately. Distinguish code committed, code pushed, deployment ready, schema applied and live behavior verified.
- Never put credentials, hashes, private PDFs, student identifiers or personal records in these notes. Link to code and describe evidence without copying sensitive data.

Keep entries factual and concise. Correct stale current-state notes rather than appending contradictory instructions. Use Git history for line-by-line changes; the handoff log explains the meaningful result. If more detail is needed, add a focused file under `docs/agents/` and link it from its index.

These instructions govern this web repository. They do not automatically update sibling repositories; when working there, maintain their own applicable handoff guides too.

## Latest handoff

2026-11-22 — Reverted the first admin workspace redesign at the user's request, restoring the previous dashboard, Classes and Students UI. No database, account or deployment behavior changed. The unrelated local Hnia/payment work and demo script remain untouched.
