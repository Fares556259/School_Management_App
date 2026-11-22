# Agent change log

Append one entry per logical change. Update the root `AGENTS.md` Latest handoff in the same commit. Older Git history contains the full diffs; this log records behavior and handoff context.

## Baseline — work completed before this log

- Strict PDF importer: deterministic extraction, manual review/export, transactional students/guardians, duplicate protection and sibling grouping. In-app AI review was removed by user request. Birthdays became optional. See `docs/strict-pdf-staging.md`.
- Class roster assignment: paste lists and match IDs/exact names, block conflicts, require expected count, preserve existing class members. Commits `5cc81ab` and `9957c7c` introduced the flow and corrected the integer lock cast.
- Parent slips: class-scoped account view and repeatable sibling-consistent codes, six cut-out slips per A4 page. `8e9bca1` added the flow; `9556fa7` added its entry point to the class-filtered student list. No live login or print-preview verification recorded.
- Student-list compatibility: `d711e75` retries without optional service assignments and surfaces core query failures rather than reporting zero students.
- Database repairs were applied separately from commits: parent columns, optional birthdays, tuitionOverrides and MobileRateLimit verified. See current-state for unresolved schema drift; do not treat these repairs as a complete migration audit.
- Repository organization: `80ed277` grouped 102 old root utilities under scripts/legacy, archived five historical documents, corrected README/setup information and added developer guides and commands. TypeScript, offline checks, current documentation links and archived file locations passed. Runtime modules were not broadly reorganized.
- `c6a5f13` added the initial root AGENTS.md.

## 2026-11-20 — Establish mandatory living agent handoffs

- Request/reason: make the repository understandable to the next agent and record every future change in agent documentation.
- Changes: expanded root `AGENTS.md`; added `docs/agents/README.md`, `current-state.md`, `feature-map.md` and this log. Root guide requires a Latest handoff update and log entry with every logical change, plus relevant state/navigation corrections.
- Verification: checked documentation links and referenced feature entry-point paths. Documentation-only; no runtime tests required.
- Operations: no database operations, account activations, code generation, application changes or deployments performed as part of this update. Commit/push status is available in Git history.
- Remaining work: future agents must maintain these files with implementation commits. Known schema gaps and unverified mobile/print flows are listed in current-state.md; investigate within the next user's requested scope.

## 2026-11-20 — Add cofounder and technical partner handbook

- Request/reason: explain the whole project in detail for a cofounder, partner and future agents.
- Changes: added `docs/handbook/README.md`, `product-and-operations.md` and `engineering.md`; linked the handbook from root README, AGENTS.md and the agent index. Documented product areas, onboarding, shared-parent access, project boundaries, code navigation, configuration, release evidence and suggested responsibilities.
- Verification: inspected existing web architecture/setup/handoff notes, Prisma models, route inventory, deployment configuration and sibling mobile/voice manifests; checked local Markdown links and diff whitespace. No runtime tests run for this documentation-only change.
- Operations: no application, database, account or deployment changes. Sibling projects were read for context, not modified or fully audited.
- Remaining work: maintain these guides with behavior changes; current-state remains the source for unresolved production gaps. Named owners, commercial terms and sibling release readiness are not established by this guide.

## 2026-11-20 — Align parent inbox with school-provisioned child linking

- Request/reason: adapt the failing parent-requests page to parents adding another child under the school-provided account/code approach.
- Changes: child-link wording in FR/EN/AR and navigation/header, existing sibling context in the inbox DTO/UI, school-scoped related records, explicit schema-unavailable state and API responses, guarded approval account activation, preserved ACTIVE status on refusal, updated child-link notifications. Added additive request/outbox repair migration and revised rollout/partner documentation. Existing mocked test expectations updated without execution.
- Verification: TypeScript passed; targeted static lint/review and diff whitespace checks. No test suites or live browser/mobile tests run, respecting the user's testing preference.
- Operations: code and migration prepared only; no production SQL, credential changes, imports, real linking or notification dispatch performed by the agent. Production schema repair remains unapplied in the recorded evidence.
- Remaining work: reconcile/apply the request/outbox repair to the intended database and complete user-run acceptance. Scope is links to existing students, not new-student enrollment. Legacy self-signup remains separately implemented.

## 2026-11-22 — Restore missing production billing schema

- Request/reason: the payment collection modal failed because public.StudentCharge was missing despite visible saved level fees.
- Changes: additive migration restores the five billing tables, composite student identity index, payment overtime columns and missing supporting settings without rewriting financial records. Billing API maps Prisma P2021/P2022 to a clear 503/BILLING_SCHEMA_REQUIRED response. Added docs/student-billing-repair.md and updated current-state/navigation.
- Verification: production metadata inspected before SQL; transaction returned success; read-only post-repair checks confirmed tables/RLS/required columns, restricted direct grants, preserved 498 students and 378 parents, unchanged payment count/total and level-fee fingerprint, no new charges/receipts. Static TypeScript and targeted lint checks; no test suites or live payment tests.
- Operations: applied the additive SQL through the existing production Supabase dashboard. No account changes, charges, receipts, collected payments, resets or seeds. Prisma migration history was not marked/reconciled; API error-message code still requires normal deployment.
- Remaining work: user acceptance by reopening the payment form; reconcile older migration history before future deployment. Parent-access schema issues are separate.
