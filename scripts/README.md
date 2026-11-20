# Scripts and checks

These tools run outside the application. Read the source and confirm environment targets before execution.

| Group | Examples | Expected impact |
|---|---|---|
| Offline rule checks | `npm run test:imports`, focused `src/__tests__` files | Pure/synthetic inputs; no production calls |
| Audits | `auditDatabaseIntegrity.ts`, `auditTenantIsolation.ts` | Read database data; verify credentials and target |
| Integration/scenario checks | `testBusinessCases.ts`, `testAttendanceWorkflow.ts`, `simulateHniaScenarios.ts` | May call providers or create/update records |
| Benchmarks | `benchmarkHnia*.ts`, `benchmarkWebSpeed.ts` | Network/provider calls and potentially usage charges |
| Local portal mock | `mockPortalServer.ts` | Starts a local test service |
| Account/tenant maintenance | `migrateAuthAppMetadata.ts`, `promote.ts`, `set-superadmin.mjs`, `seedDemoSchool.ts` | Can change access or database contents; never automatic setup |
| Historical tools | `legacy/diagnostics/`, `legacy/maintenance/`, `legacy/source-patches/` | Old assumptions, source rewrites or data changes; review before using |

`npm test` currently runs the payroll check only. `test:all` includes integration and database scripts; it is not an offline unit-test command.

[Legacy filename index](legacy/INDEX.md) maps each previous root-level utility to its new location. Historical scripts generally assume the repository root as their working directory. They have been retained for reference, not verified for use against today's schema.

When adding a maintained script, document purpose, required variables, whether it reads or writes data, and an example command here. Do not store customer exports, passwords or debug dumps in the repository.
