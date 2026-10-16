# Parent access approval

## Implemented flow

Parent registers in Arabic, French or English with the school identifier, name, phone, relationship and their own password. The server creates a PENDING account and one request per existing child; it does not assign student ownership. No date of birth or activation code is required. Before approval, only masked references, the parent's own request state, account notifications and correction actions are available.

An active school admin uses **People → Parent requests** (`/admin/parent-requests`). Requests can be filtered by class, status and search, with 25 per page. Duplicate claims are marked for individual review and excluded from bulk selection. Approval requires confirmation of identity/guardianship; refusal or revocation requires a parent-visible reason. Each child is approved separately. A conflicting existing owner can never be overwritten through approval.

The same phone/password work before and after approval. Waiting parents can refresh, receive activation alerts, sign out, cancel a request, correct their contact details and resubmit. Existing active parents can track additional-child requests from Profile. The app refreshes status on return, notification and periodic checks. Existing accounts stay ACTIVE through the additive migration.

## Phone verification

School verification was explicitly chosen for this release. No SMS verification is claimed or simulated. The dashboard labels phone numbers as requiring school verification. Staff must establish identity/guardianship before confirming approval; names and identifiers entered in an app do not prove guardianship.

## Notification behavior

Every approval, rejection or revocation creates an in-app notification and durable outbox entry in the same transaction as the decision and audit record. Push dispatch uses the existing Expo integration and localized text. Only registered devices are selected. Failed sends retry every 15 minutes (up to six attempts); a newly registered device can requeue exhausted attempts. Pending notification entries are superseded when the same request receives a later decision. An Expo accepted ticket is not a device delivery guarantee. If permission is denied or the device is offline, the parent can still see the saved decision on return.

## Deployment sequence

1. Confirm a database backup and review the additive migration `20261016120000_parent_access_approval`. It adds parent access/locale fields, request records, notification outbox records and persistent rate-limit counters. New tables enable row-level security and revoke direct anon/authenticated REST access; the server must use its trusted database owner/service role.
2. Run `npx prisma migrate deploy` against the intended environment, then deploy the web/backend code and generated Prisma client together.
3. Confirm `JWT_SECRET` (at least 32 characters), existing Expo push configuration and `CRON_SECRET` are configured. Add the `/api/cron/parent-access-notifications` schedule from `vercel.json`; it is protected with `Authorization: Bearer $CRON_SECRET`. New writes fail closed if database access is unavailable.
4. Release the mobile JS through the appropriate compatible runtime/build. New signup, pending sign-in and child-link requests require `approvalFlowVersion: 1`; older apps receive an update-required response instead of an empty or misleading success screen. Do not send native-module changes to an incompatible runtime.
5. Use two controlled parent accounts and one test child to test on a real Android device: pending → denied data access → admin approval → notification → same credentials → correct child. Also test refusal/correction, a conflicting claim and revocation. Verify active existing parents still sign in.
6. Start with one class. Confirm school staff can verify the requests, and check notification outbox/audit entries before inviting the next class.

## Verification completed during implementation

- Prisma schema validation/client generation; migration generated with Prisma schema diff.
- TypeScript checks in web and mobile.
- Backend test: `npm run test:parent-access` (mocked isolated data layer; no production records changed).
- Existing security, student-isolation and notification ownership tests.
- Mobile Jest tests, including waiting, activation, notification opt-in, Arabic rejection and cancellation.
- Android Expo production export.
- Browser interaction checks on isolated fixtures: registration → waiting screen → alert opt-in, admin identity confirmation, approval payload, conflict/rejection handling and Arabic at 390px.

Production migration, authenticated live admin/database verification and real-device push delivery are deployment checks. They were not performed by the local fixture tests.
