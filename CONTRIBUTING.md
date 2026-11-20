# Contributing to SnapSchool

Start with [setup](docs/getting-started.md) and the [feature map](docs/architecture.md). Keep changes focused on one user flow and review existing behavior before adding a parallel implementation.

## Where new code goes

- Put a page and its feature-specific server actions/components next to its route in `src/app/`.
- Extract reusable domain rules into clearly named modules in `src/lib/`. Examples: `classRoster.ts`, `studentPdfImport/prepare.ts`, `tuitionPolicy.ts`.
- Put reusable presentational UI in `src/components/`; keep database access on the server.
- Keep TypeScript types near the feature. Use Prisma types for database records and explicit DTOs for client responses.
- Prefer extending an existing feature module over growing `src/lib/crudActions.ts`. That file remains a shared legacy entry point; migrate callers incrementally rather than moving everything at once.
- Place focused checks in `src/__tests__/`. Keep operational scripts in `scripts/` and document their inputs and side effects.

## Before merging

1. Review `git status` and keep unrelated work out of your commit.
2. Run `npm run typecheck`, targeted lint, and checks relevant to the change.
3. For authentication, billing and data mutations, verify tenant ownership and failure behavior. Use synthetic data locally.
4. Document environment variables, schema changes and user-visible limitations.
5. In the PR describe the resulting behavior, checks performed, and any remaining deployment step.

## Data and access rules

Authenticate server actions and API routes, then scope records to the server-owned school ID. A client-supplied student, class or parent ID is not authorization. Validate relationships before writing. Shared-parent changes affect all siblings; never create one account per child by accident.

Use transactions for multi-record writes and verify the result. Keep missing data explicit, preserve identifiers as strings, and avoid guessing class membership. Keep credentials, private exports and student files out of logs, Git and public storage.

## Schema changes

Update `prisma/schema.prisma` and add a new chronological migration. Read existing migration history first. Generated Prisma Client updates TypeScript types but does not update a database. Verify the deployed schema separately; do not replace the migration history or run a destructive reset against a shared environment.

## Historical tools

`scripts/legacy/` preserves earlier diagnostics, database repairs and source patches. They are not setup steps. See its index before looking for an old root-level filename.
