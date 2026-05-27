# SENSITIVE_AREAS.md — SnapSchool
> Last updated: 2026-05-27

These areas are HIGH RISK. Do not modify them without a full root-cause analysis, impact map, and explicit approval.

---

## 1. Authentication & Session Management

### Web (Clerk)
| File | Risk |
|------|------|
| `SnapSchool_Web/src/middleware.ts` | **CRITICAL** — Controls ALL route access. A bug here locks out users or exposes admin routes to unauthorized roles. The pending/active status redirect logic is delicate. |
| `SnapSchool_Web/src/lib/role.ts` | **HIGH** — 3-tier role resolution (claims → API → DB). If this returns wrong role, users see wrong dashboards. |
| `SnapSchool_Web/src/lib/school.ts` | **HIGH** — Multi-tenant school ID resolution. Incorrect resolution = data leakage across schools. |
| `SnapSchool_Web/src/lib/settings.ts` | **HIGH** — `routeAccessMap` defines which roles can access which routes. A typo here = broken access control. |

### Mobile (Custom Auth)
| File | Risk |
|------|------|
| `SnapSchool_Web/src/app/api/mobile/login/` | **CRITICAL** — Phone number → user lookup. |
| `SnapSchool_Web/src/app/api/mobile/auth/` | **CRITICAL** — Password setup/signin + user provisioning. |
| `SnapSchool_App/src/services/api.ts` (authService/authStorage) | **HIGH** — AsyncStorage token management. Bugs here = users stuck logged out or logged into wrong account. |

### Why It's Dangerous
- Middleware runs on EVERY request. A crash here = full site outage.
- Role/school resolution has fallback chains — a broken fallback can silently return wrong data.
- Mobile auth is phone-based with no Clerk — custom password logic must not be broken.

---

## 2. Database Schema & Migrations

| File | Risk |
|------|------|
| `SnapSchool_Web/prisma/schema.prisma` | **CRITICAL** — 30+ models, 617 lines. Any change triggers migration. Wrong migration = data loss. |
| `SnapSchool_Web/prisma/migrations/` | **CRITICAL** — Migration history. Never delete or modify existing migrations. |
| `SnapSchool_Web/src/lib/prisma.ts` | **HIGH** — Singleton client with Prisma 6 native engine. Previous engine issues were resolved by downgrading — do NOT upgrade without testing. |

### Why It's Dangerous
- Schema changes cascade to: server actions, API routes, mobile API responses, all UI forms.
- Unique constraints exist on critical fields (`@@unique` on Payment, Grade, Attendance). Adding/removing these can cause silent data integrity failures.
- The `schoolId` default `"default_school"` is load-bearing — removing it breaks single-school installations.

---

## 3. Payment & Financial Logic

| File | Risk |
|------|------|
| `SnapSchool_Web/src/lib/crudActions.ts` (payment sections) | **HIGH** — Tuition collection, salary payments, partial payments, deferred amounts. Financial accuracy is non-negotiable. |
| `SnapSchool_Web/src/lib/audit.ts` | **HIGH** — Audit log for all financial transactions. Must never fail silently in a way that loses the audit trail. |
| `SnapSchool_Web/src/app/api/finance/` | **HIGH** — Financial API endpoints. |
| `SnapSchool_App/src/services/api.ts` (studentService.fetchPayments) | **MEDIUM** — Client-side payment timeline reconstruction. Complex academic-year logic (Sep–Jun). |

### Why It's Dangerous
- Payment records have unique constraints per student/teacher/staff per month/year. Duplicate creation = crash.
- Partial payment and deferral logic is stateful — incorrect state transitions leave money untracked.
- Audit logs are the compliance backstop. If `createAuditLog` breaks, there's no record of financial operations.

---

## 4. Push Notifications

| File | Risk |
|------|------|
| `SnapSchool_Web/src/lib/notifications.ts` | **HIGH** — 6 notification functions with deduplication logic. Broken dedup = notification spam to parents. Missing dedup = missed critical alerts. |
| `SnapSchool_App/src/services/notificationService.ts` | **MEDIUM** — Client-side push token registration and handling. |

### Why It's Dangerous
- `processPaymentReminders` has a 6-hour dedup window. Modifying the window or the query changes notification frequency for ALL parents.
- `createAttendanceNotification` uses day-boundary dedup. Timezone bugs = duplicate or missing absence alerts.
- Push tokens are stored on Parent and Teacher models. Incorrect token management = silent notification failures.

---

## 5. AI Scoring & Insights

| File | Risk |
|------|------|
| `SnapSchool_Web/src/app/api/admin/insights/` | **MEDIUM** — AI-generated financial insights via OpenRouter. |
| `SnapSchool_Web/src/app/api/smart-insights/` | **MEDIUM** — Smart insight generation. |
| `SnapSchool_Web/src/lib/insightsCache.ts` | **MEDIUM** — Caching layer for AI responses. |

### Why It's Dangerous
- AI calls are expensive and rate-limited. Broken caching = runaway API costs.
- Insights are displayed to admins making financial decisions. Wrong data = wrong decisions.

---

## 6. Grade Management & Report Cards

| File | Risk |
|------|------|
| `SnapSchool_Web/src/app/api/grades/` | **HIGH** — Grade sheet upload and AI-based grade extraction. |
| `SnapSchool_Web/src/app/api/report-card/` | **HIGH** — Report card PDF generation. |
| `SnapSchool_Web/src/app/(dashboard)/admin/grades/` | **HIGH** — Grade management UI. |

### Why It's Dangerous
- Grades have a unique constraint `@@unique([studentId, subjectId, term])`. Duplicate inserts crash.
- Grade sheets link to proof URLs (uploaded images). Broken upload = unverifiable grades.
- Report cards are official documents. Incorrect data = institutional credibility damage.

---

## 7. File Upload & Storage

| File | Risk |
|------|------|
| `SnapSchool_Web/src/app/api/mobile/upload/` | **MEDIUM** — File upload endpoint for mobile. |
| `SnapSchool_Web/src/app/uploads-proxy/` | **MEDIUM** — Proxy for serving uploaded files. Excluded from middleware auth intentionally. |

### Why It's Dangerous
- Upload proxy is explicitly excluded from Clerk auth middleware (`uploads-proxy` in matcher exclusion). Changing the middleware matcher can break ALL mobile image loading.
- Storage is on Supabase. Incorrect bucket permissions = public exposure of student photos.

---

## 8. Multi-Tenancy (schoolId)

| Scope | Risk |
|-------|------|
| Every model with `schoolId` field | **HIGH** — Data isolation between schools. A query missing `where: { schoolId }` leaks data across tenants. |
| `getSchoolId()` / `getSchoolIdFromHeader()` | **HIGH** — If these return wrong school, all subsequent queries return wrong data. |

### Why It's Dangerous
- This is the single most widespread pattern in the codebase. Almost every query filters by `schoolId`.
- The fallback to `"default_school"` is intentional for backwards compatibility. Removing it breaks existing installations.
