# SnapSchool

School administration web app and backend for the SnapSchool mobile client. It manages students, parent accounts, classes, attendance, billing and school communications, with optional Hnia AI and Telegram integrations.

**New here?** Read [Getting started](docs/getting-started.md), then [Architecture and feature map](docs/architecture.md). See [Contributing](CONTRIBUTING.md) before making changes.

## Stack

Next.js 15 App Router, React 18, TypeScript, Tailwind CSS, Prisma 6 and PostgreSQL. Web authentication uses Supabase; mobile endpoints use signed tokens and role checks. The strict PDF worker runs Python with PyMuPDF. Vercel hosts the application.

## Repository map

| Location | Purpose |
|---|---|
| `src/app/` | Next.js pages, layouts, API routes and route-local server actions |
| `src/components/` | Shared UI and forms |
| `src/lib/` | Business rules, database access, tenant checks and integrations |
| `src/utils/supabase/` | Supabase browser/server clients |
| `src/__tests__/` | Focused automated checks |
| `prisma/` | Database schema, chronological migrations and seed tools |
| `api/` | Standalone Vercel Python HTTP functions |
| `services/` | Python PDF extraction implementation |
| `public/` | Public assets; never put private exports or credentials here |
| `scripts/` | Operational tools and integration checks; read its guide first |
| `scripts/legacy/` | Historical root utilities, grouped and indexed |
| `docs/` | Current developer and feature guides |
| `docs/archive/` | Historical design and workflow notes; not current setup instructions |

This checkout is `SnapSchool_Web`. The sibling `SnapSchool_Mobile` and `voice-agent` folders in the parent workspace are separate projects, not packages installed by this repository.

## Quick start

Use Node.js 24 to match the configured deployment. Configure a **development** Supabase/PostgreSQL environment as described in [Getting started](docs/getting-started.md).

```sh
npm ci
cp .env.example .env
# Fill in development values before continuing.
npx prisma generate
npm run dev
```

Open `http://localhost:3000`. Installing dependencies and generating Prisma Client do not apply database migrations. Database initialization is a separate, deliberate step documented in the setup guide.

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js locally |
| `npm run build` | Generate Prisma Client and build Next.js |
| `npm run lint` | Next.js/ESLint checks |
| `npm run typecheck` | TypeScript without emitting files |
| `npm test` | Existing payroll test entry point; not the entire suite |
| `npm run test:imports` | Offline PDF preparation, family and class-list matching checks |

Many `test:*` scripts access a database or external services. [Scripts guide](scripts/README.md) distinguishes them from local checks.

## Feature documentation

- [PDF student/parent import](docs/strict-pdf-staging.md)
- [Parent access rollout](docs/parent-access-rollout.md)
- [Class parent login slips](docs/class-parent-access-slips.md)
- [Hnia reliability](docs/HNIA_RELIABILITY.md)
- [Brand system](docs/brand-system.md)

Production data belongs to real schools. Use reviewed migrations and test tenants; never use a database reset, seed, or historical repair script as an onboarding shortcut.
