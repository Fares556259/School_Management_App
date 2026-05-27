# PROJECT_CONTEXT.md — SnapSchool
> Last updated: 2026-05-27

## What Is SnapSchool?
SnapSchool is an AI-powered school management platform consisting of two applications:
1. **SnapSchool_Web** — An admin/teacher dashboard (Next.js 14)
2. **SnapSchool_App** — A parent/teacher mobile app (Expo SDK 54 / React Native)

Both share the same PostgreSQL database hosted on **Supabase** (eu-west-1 region). There is no local Docker database in use.

---

## Repository Structure
```
/Users/faresselmi/projects/hi/
├── SnapSchool_Web/        # Next.js 14 (App Router) — Admin Dashboard
├── SnapSchool_App/        # Expo SDK 54 — Mobile App (iOS/Android)
├── idk/                   # Temp backups
├── notes/                 # Engineering docs (this folder)
└── run.sh                 # Dev launcher script
```

---

## Tech Stack

### SnapSchool_Web
| Layer           | Technology                              |
|-----------------|----------------------------------------|
| Framework       | Next.js 14.2.5 (App Router)           |
| Language        | TypeScript                             |
| Auth            | Clerk (`@clerk/nextjs` v5)             |
| Database        | PostgreSQL via Supabase                |
| ORM             | Prisma 6 (native Rust engine)          |
| Styling         | Tailwind CSS 3 + shadcn/ui (Radix)    |
| AI              | OpenRouter (economy mode) via fetch    |
| Email           | Resend                                 |
| Push Notifs     | Expo Server SDK (server-side)          |
| Charts          | Recharts                               |
| Animations      | Framer Motion                          |
| Deployment      | Vercel                                 |

### SnapSchool_App
| Layer           | Technology                              |
|-----------------|----------------------------------------|
| Framework       | Expo SDK 54 (managed workflow)         |
| Language        | TypeScript                             |
| UI              | NativeWind 4 (Tailwind for RN)        |
| State           | Zustand                                |
| Navigation      | React Navigation 7 (native stack)      |
| Storage         | AsyncStorage                           |
| Push Notifs     | expo-notifications                     |
| API Client      | Custom `apiFetch` wrapper with dedup   |

---

## Database
- **Provider:** Supabase PostgreSQL (pooler endpoint, eu-west-1)
- **Connection:** Via `DATABASE_URL` in `.env` / `.env.local` (connection pooling enabled, `connection_limit=1`)
- **Schema:** 30+ models defined in `prisma/schema.prisma`
- **Multi-tenancy:** All major models have a `schoolId` field defaulting to `"default_school"`
- **Migrations:** Managed via `prisma/migrations/`

---

## Authentication Flow
1. **Web:** Clerk session-based auth → `middleware.ts` checks role + status → route-based access control via `routeAccessMap`
2. **Mobile:** Phone number → custom auth via `/api/mobile/login` and `/api/mobile/auth` → user ID + role stored in AsyncStorage → `x-school-id` header sent on every request

---

## User Roles
| Role        | Web Dashboard | Mobile App |
|-------------|---------------|------------|
| superadmin  | ✅ Full system | ❌         |
| admin       | ✅ School mgmt | ❌         |
| teacher     | ✅ Limited     | ✅ Attendance, tasks, resources |
| parent      | ✅ Read-only   | ✅ Full parent features |
| student     | ✅ Read-only   | ❌ (viewed via parent) |

---

## Key Services & Modules
- **`crudActions.ts`** (35KB) — Server actions for all CRUD operations
- **`data.ts`** (21KB) — Data fetching utilities for dashboard pages
- **`notifications.ts`** (14KB) — Push notification + in-app notification engine
- **`audit.ts`** — Immutable audit log for all admin modifications
- **`school.ts`** — Multi-tenant school ID resolution chain (DB → JWT → Clerk API → fallback)
- **`role.ts`** — Role resolution with 3-tier fallback (claims → API → DB)
- **`insightsCache.ts`** — AI insights caching layer

---

## External Service Dependencies
| Service       | Purpose                    | Config Location     |
|---------------|----------------------------|---------------------|
| Supabase      | Database + Storage         | `.env`, `.env.local`|
| Clerk         | Web authentication         | `.env`, `.env.local`|
| OpenRouter    | AI insights (Gemini proxy) | `.env` (GEMINI_API_KEY) |
| Resend        | Transactional email        | `.env`              |
| Vercel        | Web deployment             | `.vercel/`          |

---

## Current State (2026-05-27)
- **Web:** Running on `localhost:3000`, compiling and serving pages successfully. `Error handling upgrade request` messages in console are benign (WebSocket upgrade mismatch from Expo Metro, not a real error).
- **Mobile:** Running on Metro Bundler port `8082` (8081 occupied by another project).
- **Database:** Connected to remote Supabase, resolving `schoolId` correctly.
- **No Docker** is used. The `docker-compose.yml` in the repo is legacy/unused.
