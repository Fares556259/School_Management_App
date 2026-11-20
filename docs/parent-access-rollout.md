# Parent child-link requests

Updated: 2026-11-20. Current approach: schools import students and shared guardian records, then prepare phone/code access through [class slips](class-parent-access-slips.md). An existing parent can request another child from the mobile app. This inbox reviews the link; it does not create a student or a second family account.

## Current workflow

1. The parent signs in with their existing school-provided credentials or their personal password.
2. In the mobile app, Add a child submits the existing student's identifier to `POST /api/mobile/students`, with `approvalFlowVersion: 1`.
3. The server resolves exactly one student within the authenticated parent's school. It returns `alreadyLinked` for a child already attached to that parent; repeated pending requests reuse the request.
4. A new request remains PENDING. Submission never sets `Student.parentId` or creates a student.
5. The administrator opens People → Child-link requests (`/admin/parent-requests`). Each request shows the parent's contact details, requested student and currently linked children/classes.
6. Approval requires confirmation of identity/guardianship, links only the requested student, and preserves the same account, phone and password. Refusing an additional-child request does not downgrade an ACTIVE account. Suspended/unavailable accounts cannot be activated by approving a link.
7. A conflicting existing parent link cannot be overwritten. Duplicate pending claims require individual review and are excluded from bulk selection. Refusal/revocation requires a parent-visible reason.

Students not yet registered must be added through school administration first. The existing request model represents a link to an existing student, not a new-enrollment application. Legacy self-registration endpoints remain separate; this change does not redesign or remove them.

## Notifications and access

Decisions, link changes, audit entries, an in-app notification and the durable push outbox are written transactionally. Approval notifications now describe a child link, not replacement credentials. No SMS verification is claimed; administrators verify identity and guardianship using school records.

Push uses the existing Expo integration. Retries and registered-device handling remain unchanged. A failed transaction must not leave a child linked without its decision. Existing children stay accessible when a request for another child is refused. Revoking the last approved child still follows the existing access-removal policy; it is distinct from refusing an additional link.

## Missing database tables

The earlier production handoff recorded missing ParentAccessRequest. The inbox now explicitly renders `SCHEMA_REQUIRED` rather than crashing or presenting missing tables as zero requests. Other database failures are not converted into a successful empty inbox. The mobile submission endpoint returns a JSON 503 for this known schema gap; administrator decisions fail without committing links when the required tables are unavailable.

Prepared repair: [20261120110000_repair_parent_child_link_requests](../prisma/migrations/20261120110000_repair_parent_child_link_requests/migration.sql).

This additive transaction creates missing request/outbox tables, indexes and foreign keys, preserves existing parent columns and records, enables RLS, and revokes direct anon/authenticated REST access. It deliberately does not modify students, guardian links or passwords. It does not reconcile every possible partially installed schema.

For deployment, inspect the target schema and migration history first. The original `20261016120000_parent_access_approval` also adds parent columns and MobileRateLimit; parts were previously repaired manually. Do not blindly rerun that SQL or mark it applied without checking every statement. A maintainer must reconcile the history and apply the relevant reviewed repair to the intended database. This change prepares the repair; it does not establish that production received it.

## Code map

- Page: `src/app/(dashboard)/admin/parent-requests/page.tsx`.
- UI and translations: `src/components/ParentAccessInbox.tsx`, `src/lib/parentAccessCopy.ts`.
- Query and explicit response DTO: `src/lib/parentAccessInbox.ts`.
- Admin API and transaction rules: `src/app/api/admin/parent-access/route.ts`, `src/lib/parentAccess.ts`.
- Missing-schema classifier: `src/lib/parentAccessSchema.ts`.
- Parent submission: `src/app/api/mobile/students/route.ts`.
- Notifications: `src/lib/parentAccessNotifications.ts`.

## Verification boundary

The 2026-11-20 change received TypeScript and targeted static review. No test suite, browser/mobile live flow, production migration, account activation or notification delivery was run for this change, following the user's preference to perform testing themselves. Existing mocked test expectations were maintained for the guarded account update and new notification wording; they were not executed.

Historical test reports for the earlier self-registration flow are not acceptance evidence for this revised inbox. Live acceptance and schema application remain separate release steps.
