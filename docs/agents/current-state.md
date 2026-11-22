# Current implementation and unfinished work

Last reconciled: 2026-11-22. This is a point-in-time handoff, not a substitute for inspecting the current checkout, schema or deployment.

## Before editing

Run `git status --short`. At this handoff, unrelated local work existed in Hnia payment/agent files and `scripts/createDemoSchoolSafely.ts`. Do not stage or revert it. Recheck rather than assuming the file list stays unchanged.

The active development branch in this session is `completed`. Work has been pushed to origin, but verify the current branch and remote before publishing. The workspace also contains separate mobile and voice-agent projects.

## Student and parent PDF importing

Implemented: authenticated deterministic PyMuPDF extraction, source-coordinate evidence, exact Unicode preservation, review/export, manual verification, and transactional creation/reuse of students and parents. The in-app AI audit was explicitly removed at the user's request.

Birthday is optional in the Student schema; absent values are NULL. No date file is required. Empty address and blood type remain empty strings. IDs remain strings with leading zeros. Whole guardian names are preserved rather than guessing their split. Exact guardian name + phone groups siblings; conflicts block the import. Existing matching students are skipped, differing records block the transaction. Parent accounts created by import are PENDING, without passwords. Exact classes are assigned separately.

Historical evidence from this session: the source register and exported records matched on 498 students across 33 pages; 17 were preparatory students. The user later showed 498 existing students and 378 reused guardians. These counts describe that import only, not future school data or test fixtures.

## Class assignment

The class assignment modal has a separate paste-list panel. It prioritizes 12-digit IDs, with exact normalized name matching only when no IDs are present. It rejects unknown/ambiguous students, duplicate entries, wrong levels and students assigned to another class. Expected count confirmation prevents a pasted multi-class document from being silently assigned to one class.

The roster action adds students without removing existing class members, validates capacity and tenant/level ownership, writes transactionally and verifies the result. Its advisory lock requires an explicit integer cast for the class ID. The older manual selection action in `crudActions.ts` has different replace-selection semantics; do not confuse the two.

## Parent mobile codes and A4 slips

Implemented entry points: class detail page and student list when a numeric class filter is selected → `Accès parents · Fiches A4`. The admin can view linked accounts, explicitly prepare access, then print one slip per child, laid out six per A4 page.

An eight-digit code is derived per school + parent using server-only PARENT_SLIP_SECRET, falling back to JWT_SECRET. Siblings across different classes receive the same code. Passwords remain bcrypt hashes. Reprints preserve the derived credential. Existing personal passwords are not reset or revealed; those cards request administrator assistance. Suspended/rejected accounts are not activated. Preparation assigns credentials and ACTIVE status to eligible passwordless parents; merely visiting the page does not.

The existing mobile phone/password sign-in accepts the code in the password field. A MobileRateLimit dependency check runs before preparing real accounts. The table was created and its columns verified through Supabase SQL Editor during this session.

Still unverified: real parent credential preparation/login, user password changes after using a paper code, and actual A4 print preview/pagination. The user previously asked to perform live testing themselves. Do not activate or reset real parent accounts just to test without renewed task authorization.

## Parent additional-child requests

The administrator inbox at `/admin/parent-requests` now presents child-link requests for existing registered students, consistent with school-provisioned phone/code accounts. It shows the requesting parent's already linked children/classes. Submission remains pending until school approval and does not create student/parent records or transfer another parent's child. Approval preserves credentials and rejects activation of unavailable/suspended accounts. Refusing an additional-child request preserves ACTIVE account status; revoking the last approved child retains the previous access-removal policy.

Missing ParentAccessRequest schema now produces an explicit unavailable state rather than a Server Component crash or misleading empty inbox. Added repair `20261120110000_repair_parent_child_link_requests` for request/outbox tables; prepared only, not applied. TypeScript/static checks performed; no test suite or live testing for this change. See [rollout notes](../parent-access-rollout.md).

## Production schema drift — important

Code and database migrations have diverged. Do not assume production matches schema.prisma merely because the build succeeds.

Applied and verified in Supabase during this session:

- Parent.accessStatus and Parent.preferredLocale exist.
- Student.birthday allows NULL.
- Student.tuitionOverrides exists as nullable JSONB.
- MobileRateLimit exists with key, count and resetAt; its migration enables RLS and revokes anon/authenticated access.

Schema findings and repair status (historical failures are not all still open):

- StudentServiceAssignment: previously missing, restored with the 2026-11-22 billing repair. The student-list compatibility fallback remains in code.
- ParentAccessRequest: child-link inbox displays a schema-required state until the corresponding schema is restored; the prepared repair is not confirmed applied.
- StudentChargeCategory and Payment.overtimeHours: restored with the 2026-11-22 billing repair, together with StudentCharge, StudentChargePayment, StudentBillingReceipt and Payment.overtimeRate. See the billing section below.

The student list must not show a query failure as a genuine zero-student result. Core fallback failures now throw an error instead.

Database CLI connections were unreliable. Supabase dashboard SQL succeeded after an explicitly approved termination of a particular idle transaction blocking DDL. That approval was for that session only; do not terminate other sessions automatically. The dashboard session can expire and require user sign-in/MFA. No passwords or tokens belong in these notes.

## Student billing repair — 2026-11-22

Production metadata confirmed that all five newer billing tables were absent; Payment also lacked its overtime columns. Applied the additive repair `20261122080000_repair_missing_student_billing` through Supabase SQL Editor. Read-back confirmed the five tables with RLS, required payment/receipt columns, restricted direct grants, preserved 498 student/378 parent totals, unchanged payment totals and level-fee fingerprint, and no new charges or receipts.

The billing API now returns a clear 503/BILLING_SCHEMA_REQUIRED for missing table/column errors instead of exposing raw Prisma errors. Static TypeScript/lint checks only; no live payment collected or test suite run. Direct SQL application does not reconcile Prisma history; review it before migration deployment. [Operational record](../student-billing-repair.md).

## Isolated demo account — 2026-11-22

Created a separate, clearly labelled demo school tenant in the existing application database on explicit user request. It has one ACTIVE administrator/auth identity, twelve fictional students (two unassigned), eight parents with shared siblings, three classes and teachers, three subjects, thirty-six grades and twenty-four attendance records. Seven levels and demonstration institution/announcements are configured. No payments/receipts/charges were seeded and no invites/messages were sent.

The create-only tool guards the project and duplicate email, writes transactionally, and verifies outside-tenant counts. Read-only post-creation checks confirmed the new admin/auth identity and hash, first-parent code/hash, siblings across classes, no demo payments and private credential-file permissions. No browser/mobile login or payment test was run. See [demo account notes](../demo-account.md). Credentials remain outside Git in a mode-0600 temporary file reported to the user. This is tenant isolation, not a separate staging database.

## Verification and deployment boundaries

Known local checks: TypeScript, targeted lint, import/family/roster/code checks passed for their respective changes. Legacy tools were relocated, not executed or certified against the current schema. No production test import was run by the agent.

For any next task, inspect fresh logs/schema and verify only within the user's authorized scope. A missing migration is a deployment task, not a reason to invent data, drop relations, reset the database or broadly push the schema.

## Compact administrative workspace — first design pass

The administrator shell now has compact navy/pale-blue styling, labeled desktop navigation at tablet width, and class/student breadcrumbs. Classes has explicit search/reset, level quick filters and a counted results section. Students has explicit draft/search/reset controls for name/identifier, level, class, month and payment status; parent-slip actions use the applied class. Payment summaries share the search/level/class predicate with table rows, fixing unassigned and identifier count mismatches.

See [design and rollout notes](../admin-workspace-design.md). This is local implementation of the first pages, not an all-page redesign or deployed/visually verified release. No test suites or live/browser flows run per user preference. TypeScript and targeted lint passed; existing Classes avatar warning remains. No data/schema/account changes.
