# Feature entry points for agents

Paths are relative to the web repository root. Follow actual imports before editing; this is a navigation map, not an exhaustive API inventory.

| Task | Start with | Rules/dependencies |
|---|---|---|
| Student list and class filter | `src/app/(dashboard)/list/students/page.tsx`, `StudentListClient.tsx` | Tenant-scoped server query; optional service-relation fallback; client filters |
| PDF import UI | `src/app/(dashboard)/list/students/StrictPdfImport.tsx` | `src/app/api/admin/student-pdf-import/route.ts` |
| PDF source extraction | `src/lib/studentPdfImport/extract.ts`, `api/student_pdf.py` | `services/student-pdf-import/extract.py`, pinned `requirements.txt`; signed internal call |
| Import validation/commit | `src/lib/studentPdfImport/prepare.ts`, `commit.ts`, `schema.ts` | Exact guardian grouping; nullable birthdays; matching reimports; transaction/read-back |
| Class-list matching | `src/components/ClassRosterImport.tsx`, `AssignStudentsModal.tsx` | `src/lib/classRoster.ts`, `src/app/(dashboard)/list/classes/rosterActions.ts` |
| Parent slips | `src/app/(dashboard)/list/classes/[id]/parent-access/` | `src/lib/parentSlipCode.ts`; admin-only generation; private code handling |
| Parent account directory | `src/app/(dashboard)/list/parents/` | Shared parent ID links all siblings |
| Phone lookup / sign-in | `src/app/api/mobile/login/route.ts`, `auth/route.ts` | `src/lib/parentAccess.ts`, `mobileAuth.ts`, `mobileRateLimit.ts` |
| Parent approval | `src/lib/parentAccessAdmin.ts`, `parentAccessInbox.ts`, `parentAccess.ts` | ParentAccessRequest / ParentAccessDelivery tables; inspect pending migrations |
| Data authorization | `src/lib/studentProfile.ts`, `school.ts`, `role.ts` | Server-owned active admin + school membership |
| Database evolution | `prisma/schema.prisma`, `prisma/migrations/` | Generate Client and apply migrations are separate operations |
| Hnia and Telegram | `src/lib/agent/`, `src/lib/telegram/` | Existing unrelated local changes may be in these folders |

Focused local checks:

- `src/__tests__/student-pdf-staging.test.ts`
- `src/__tests__/student-pdf-family.test.ts`
- `src/__tests__/class-roster.test.ts`
- `src/__tests__/parent-slip-code.test.ts`

Operational and historical tools: read `scripts/README.md` and `scripts/legacy/INDEX.md`. Do not execute a script solely because its filename says check, fix or test.
