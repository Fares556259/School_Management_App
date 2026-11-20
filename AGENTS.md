# Working in SnapSchool Web

## Start here

Read `README.md`, `docs/architecture.md` and `CONTRIBUTING.md`. For local setup, use `docs/getting-started.md`. These describe the current repository; `docs/archive/` contains historical material.

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
