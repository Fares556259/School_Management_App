# Architecture and feature map

## Request flow

```text
Web page / shared component
  → route-local server action or API route
  → authentication + server-owned school ID
  → domain rules in src/lib
  → Prisma → PostgreSQL
  → explicit response DTO → UI
```

Web session helpers are in `src/utils/supabase/server.ts`; tenant and role helpers are `src/lib/school.ts`, `role.ts` and `studentProfile.ts`. `src/middleware.ts` handles web routing/session behavior. Route-level authorization is still required when middleware is bypassed.

Mobile is a separate client using `src/app/api/mobile/`. Phone lookup and password authentication live in `login/route.ts` and `auth/route.ts`; token verification and rate limiting live in `src/lib/mobileAuth.ts` and `mobileRateLimit.ts`.

## Find the code for a task

| Feature | UI / API entry points | Domain code |
|---|---|---|
| Students | `src/app/(dashboard)/list/students/` | `studentProfile.ts`, `studentIdentifier.ts`, `crudActions.ts` |
| Classes and assignment | `list/classes/`, `components/AssignStudentsModal.tsx` | `classRoster.ts`, route-local `rosterActions.ts` |
| PDF registration import | `list/students/StrictPdfImport.tsx`, `api/admin/student-pdf-import/` | `studentPdfImport/`, Python `services/student-pdf-import/` |
| Parent accounts | `list/parents/`, `api/mobile/auth/` | `parentAccess*.ts`, `mobileStudentLink.ts` |
| Printable parent codes | `list/classes/[id]/parent-access/` | `parentSlipCode.ts` |
| Student billing/services | `api/admin/student-billing/`, admin finance routes | `studentBilling.ts`, `studentCharges.ts`, `tuitionPolicy.ts`, `cashRegister.ts` |
| Attendance | attendance routes and components | `attendanceRoster.ts`, `attendanceNotifications.ts`, certificate helpers |
| Timetables | class/timetable routes | `timetableEditor.ts`, `timetableConflicts.ts` |
| Hnia assistant | mobile/admin AI entry points | `agent/`, `telegram/`, `voice/` |
| Generated documents | document/receipt routes | `pdf/`, `excel/`, `word/`, `report-cards/` |
| Localization | `providers/`, translated components | `lib/translations/` |

UI/API paths in the table are relative to `src/app/` unless a full `src/` prefix is shown. Library paths are relative to `src/lib/`.

## Important relationships

A school owns students, parents, classes and levels. A student has an optional class and optional parent, but a required pedagogical level. One parent may have many children, including children in different classes. A class's database ID is not the same as its grade number; preparatory grade is 0. Student national IDs are strings so leading zeros survive.

The main PDF import creates or reuses students/guardians separately from class assignment. Parent mobile activation is also a separate administrator action. See the linked feature guides in the root README for current behavior and limits.

## Working with existing structure

There are two action layers: older shared mutations in `src/lib/crudActions.ts` and newer route-local actions. Do not assume similarly named actions are equivalent. Follow the actual component import to find the live path. Keep a single implementation of a domain rule and move callers gradually when refactoring.

Not all `src/lib` modules are pure: some perform database or provider calls. Keep them out of client imports. Pure modules such as `classRoster.ts` are suitable for offline tests.

## Runtime boundaries

- Next.js serves web UI, server actions and TypeScript APIs.
- `api/student_pdf.py` is a standalone Python Vercel function, separate from Next.js route files.
- `services/student-pdf-import/extract.py` performs deterministic extraction without writing student records.
- Database migrations are deployment operations, not requests handled by the app.
- `scripts/` tools are manually invoked development/operations entry points.

## Known improvement areas

The shared CRUD module is large, test entry points are mixed, configuration files need eventual consolidation, and operational tooling needs further review. Historical utilities have been moved out of the root, not promoted into maintained tools. This organization pass documents the current architecture; it does not claim every module has been redesigned.
