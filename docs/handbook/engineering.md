# Engineering and technical partner guide

Last reviewed: 2026-11-20. This guide maps the current implementation; it does not introduce a new runtime folder structure.

## Start a task with evidence

Read root AGENTS.md and the agent handoff documents. Inspect `git status --short` and the current branch before editing. There is unrelated local assistant/payment work in this checkout; preserve it. Follow the actual imports from a page or API rather than assuming every similarly named helper is active.

For a bug, separate browser behavior, API response, authorization, domain validation and database state. A zero-student screen, for example, can arise from filters, school scope or a failed database query; it does not by itself prove the import lost records.

## Web repository layout

| Location | What belongs here | How to work with it |
|---|---|---|
| `src/app/(dashboard)/` | Dashboard pages, route-local components and server actions | Start from the affected URL; route groups do not appear in URLs |
| `src/app/api/` | HTTP endpoints, including the mobile backend | Check caller contract, authentication, school scope and error responses |
| `src/components/` | Reused UI and forms | Keep server secrets and database clients out of client imports |
| `src/lib/` | Domain rules, authorization, persistence helpers and integrations | Check whether a module is pure or performs I/O before reusing it |
| `src/utils/supabase/` | Browser/server authentication clients | Follow existing session patterns |
| `prisma/` | Schema, migrations and seed tooling | Changes require a reviewed migration and separate environment application |
| `api/` and `services/` | Python PDF HTTP function and extraction implementation | Separate runtime from TypeScript routes |
| `src/__tests__/` | Focused checks | Inspect dependencies before running; some tests involve services |
| `scripts/` | Operational tooling | Read the scripts guide and side effects first |
| `scripts/legacy/` | 102 relocated historical utilities with an index | Preserved references, not approved setup commands |
| `public/` | Publicly served assets | Never store family exports or credentials here |
| `docs/agents/` | Current state, feature map and meaningful change history | Maintain with every logical change |
| `docs/archive/` | Earlier design/workflow documents | Historical context; may be stale |

## Trace a normal request

A server-rendered page or HTTP route obtains the authenticated identity, resolves its role and school, reads or validates input, applies domain rules, and uses Prisma for database access. The UI receives a deliberate response rather than an unrestricted database record.

Server actions and mobile routes are separate entry points into related business concepts. Middleware helps with web sessions/routing, but does not replace route-level authorization. Never authorize a mutation using only a school ID sent by the client.

Important entry points include `src/middleware.ts`, `src/lib/school.ts`, `role.ts`, `studentProfile.ts`, `mobileAuth.ts` and `mobileRateLimit.ts`. See the [feature map](../agents/feature-map.md) for import and parent-access files.

## Domain relationships

```text
School
 ├─ levels ── classes
 ├─ students ── optional class, required level
 │     ├─ optional guardian link
 │     └─ attendance / grades / payments / services / charges
 ├─ parents ── multiple linked students
 ├─ teachers / staff
 └─ academic, financial and communication records
```

This is a conceptual map, not an exhaustive schema diagram. The actual relations, indexes, optionality and enums are in `prisma/schema.prisma`.

Preserve student identifiers as strings. A level's number, its database ID and a class's database ID are different values. Parent changes can affect siblings in several classes. Account access, class enrollment and billing state are separate concepts.

## Main workflows and extension points

| Work | UI or API starting point | Domain / dependency |
|---|---|---|
| Student directory and filters | `src/app/(dashboard)/list/students/` | `studentProfile.ts`, `studentIdentifier.ts`, billing helpers |
| Strict PDF onboarding | `StrictPdfImport.tsx` in the student route; `src/app/api/admin/student-pdf-import/route.ts` | `src/lib/studentPdfImport/`, `api/student_pdf.py`, `services/student-pdf-import/` |
| Class matching and assignment | `src/components/ClassRosterImport.tsx`, `AssignStudentsModal.tsx` | `src/lib/classRoster.ts`, class route `rosterActions.ts` |
| Guardian directory and access | `src/app/(dashboard)/list/parents/`, class `[id]/parent-access/` | `parentAccess*.ts`, `parentSlipCode.ts` |
| Mobile identity | `src/app/api/mobile/login/route.ts`, `auth/route.ts` | Password hashing, access status, token verification and rate limits |
| Teaching and family data | `src/app/api/mobile/teacher/`, `parent/`, attendance/results/tasks routes | Role-specific record ownership; inspect each active route |
| Student finance | `src/app/api/admin/student-billing/`, student finance UI | `studentBilling.ts`, `studentCharges.ts`, `tuitionPolicy.ts`, `cashRegister.ts` |
| Personnel finance | Teacher/staff profile and payment routes | Payment and payroll rules; focused payroll checks |
| Hnia and messaging | Assistant route, mobile agent APIs, Telegram routes | `src/lib/agent/`, `telegram/`, `voice/` |
| Generated outputs | Document and receipt routes | `src/lib/pdf/`, `excel/`, `word/`, `report-cards/` |

Older code places many actions in `src/lib/crudActions.ts`; newer code uses focused modules and route-local actions. Extend the appropriate active path. Refactor one domain at a time and migrate its callers rather than moving all files to a theoretical structure at once.

## Integrations and configuration

- **Supabase:** web authentication and infrastructure used by application features. Development needs appropriate Auth setup as well as a database.
- **PostgreSQL / Prisma:** persistent application records and relations. Generated Client types do not guarantee the deployed schema exists.
- **Python / PyMuPDF:** deterministic register extraction. Local execution uses STUDENT_PDF_PYTHON; Vercel uses the Python function runtime and pinned requirements.
- **Mobile authentication:** server-only JWT_SECRET, bcrypt password checks and database-backed rate limiting.
- **Parent slips:** PARENT_SLIP_SECRET, with JWT_SECRET fallback. Changing the derivation secret can change derived codes and must be treated as a credential rollout decision.
- **Optional providers:** AI, Telegram, LiveKit, mail and analytics have separate configuration. Only enable what the task requires.

Read `.env.example` for variable names; never copy working secrets into this handbook. Values prefixed NEXT_PUBLIC_ may be exposed to clients. Provider plugins listed in a manifest do not prove a provider is enabled or reachable.

## Local setup and useful checks

Use the [setup guide](../getting-started.md) for development credentials, Node.js 24, installation and deliberate migration application. The standard web commands are:

| Command | Meaning |
|---|---|
| `npm ci` | Install the locked dependencies |
| `npx prisma generate` | Generate the Prisma client; no schema application |
| `npm run dev` | Run Next.js locally |
| `npm run typecheck` | TypeScript without emitted output |
| `npm run lint` | Configured lint checks |
| `npm run test:imports` | Focused offline import/family/roster/parent-code checks |
| `npm test` | Payroll test entry point, not the full test suite |
| `npm run build` | Generate Prisma client and build the web app |

`test:all` and several scripts can access databases or providers. Read them first. A documentation-only change does not require runtime tests. The user previously reserved live testing for themselves; do not create real accounts or import data merely to validate a screen.

The mobile manifest provides Expo start and platform run commands. The voice manifest provides dev/start/console and typecheck commands. Use their own setup instructions rather than applying the web installation process across all three projects.

## Deployment and migrations

The web application targets Vercel. `vercel.json` defines the Python function and scheduled endpoints for student charges, Telegram briefing, daily reports, payment reminders and parent access notifications. Declared schedules do not prove recent successful executions. Inspect the route's authorization and job behavior before triggering it manually.

Both `next.config.js` and `next.config.mjs` exist; inspect configuration before edits. Consolidating them is a separate behavior change.

A release handoff should distinguish:

1. Code committed and pushed.
2. Build/deployment result for the intended commit and environment.
3. Required migrations applied and actual columns/tables verified.
4. User flow accepted, including its failure behavior.
5. Any mobile API compatibility or separate mobile/voice release work.

Production has recorded schema drift, including errors beyond the PDF importer. Read [current state](../agents/current-state.md). Fix the specific verified gap using reviewed changes; do not use blanket schema pushes, resets or seed runs to make errors disappear. A fallback that omits an optional relation is not equivalent to repairing that feature's database.

## Collaborating with another partner or agent

Keep one logical change per focused commit/PR. Describe the concrete user outcome, relevant paths, checks actually run and deployment steps still required. Preserve unrelated local modifications. For API changes, inspect mobile callers and response compatibility before release.

Every change must update root AGENTS.md Latest handoff and append the agent change log. Update this handbook if architecture, setup or product behavior changes, and current-state when an issue is fixed or newly identified. Handoff documentation is part of the implementation, not a later optional task.

Recommended first contribution: choose a bounded issue from current-state, trace its caller-to-database flow, agree acceptance criteria, implement in the existing structure, run proportionate checks, and record what is still unverified. Broader modernization should follow working feature boundaries and evidence.
