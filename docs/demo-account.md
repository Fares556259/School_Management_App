# Isolated demo account and fake school data

Created on user request: 2026-11-22. This is a separate school tenant in the application's existing database, not a separate staging deployment/database. Its users must never receive membership in a real school.

## Data provided

- One new email/password administrator, ACTIVE and restricted to the demo school.
- A clearly named `DEMO — École fictive` school and demonstration institution settings for 2026–2027.
- Seven levels (0–6), three classes (1A, 1B, 2A), three subjects and three teacher records.
- Twelve fictional students: ten assigned to classes, two unassigned.
- Eight ACTIVE parent accounts with synthetic non-routable phone numbers and individually generated codes.
- Shared guardians for sibling pairs. The first parent has two children in different classes using the same account/code.
- Thirty-six sample grades, twenty-four sample attendance records and two demonstration announcements.

No financial payments, receipts or charges were seeded. No invitations, email, push notifications or external-provider requests were sent. These records are intended for the user's manual testing, including payment entry. Do not interpret them as real school financial activity.

## Credentials

Generated credentials are stored only in a private mode-0600 file outside the repository, named `/private/tmp/snapschool-demo-account-<suffix>.txt`. The creation result reports the exact path. Open the file locally for the web administrator and first mobile parent login. Do not copy credentials into Git, logs, issues, screenshots or this document. Private temporary files can be removed by system cleanup; store access details appropriately before that happens.

No existing account password was reset. Teacher records are included as data; teacher mobile credentials were not provisioned. The parent code is an initial demo password, not a claim that the class-slip generation UI was exercised. A personal password is preserved by the existing slip workflow.

## Maintained provisioning tool

See `scripts/createIsolatedDemoAccount.ts`. Without `--create` it prints a plan and performs no database operations. Creation requires an explicitly named Supabase project and a reserved `example.test` email:

```sh
node --import tsx scripts/createIsolatedDemoAccount.ts
node --import tsx scripts/createIsolatedDemoAccount.ts --create --expected-project YOUR_PROJECT_REF --email demo.admin.unique@example.test
```

The project reference must agree with both database connection identity/host and the configured Supabase project URL. The tool uses DIRECT_URL (DATABASE_URL fallback). It directly provisions a new Supabase email identity and app membership transactionally because the current setup has a trusted database connection but no configured Auth admin API key. It does not change authentication settings, send verification mail, or provision a superadministrator.

The script never deletes, upserts, resets or updates existing tenants/accounts. A reused email stops before creation. A new school identifier and namespaced record identifiers avoid mixing data with other tenants. Transactional checks compare outside-tenant counts and enforce expected data and sibling links before commit. Raw database exceptions are not logged because they can contain credential parameters.

Existing `seedDemoSchool.ts` and the unrelated local `createDemoSchoolSafely.ts` were not run or modified for this request. Some older tooling can reset records or passwords; do not substitute it for this create-only tool without review.

## Verification recorded

The explicit creation completed successfully. In-transaction counts confirmed the intended data set and unchanged outside-tenant school/student/parent/payment totals. Subsequent read-only checks confirmed:

- The new auth user, email identity, ACTIVE administrator and ACTIVE school agree on tenant and role.
- The stored administrator and parent bcrypt hashes match their generated credentials.
- The example parent's two children share one account across two classes.
- No demo Payment records exist.
- The credential file permissions are 0600.

The tool received a focused TypeScript compile and plan-only execution. No browser sign-in, mobile sign-in, payment collection or test suite was run. The user will perform functional acceptance. Demo records are persistent; removal or reset is a separate explicit task.
