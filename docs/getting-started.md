# Getting started

## Prerequisites

- Node.js 24 (matches production) and npm.
- A development PostgreSQL database and Supabase project for authentication/storage. Local Docker PostgreSQL alone does not provide Supabase Auth or Storage.
- Python with the pinned dependencies in `requirements.txt` only if working on PDF importing.

## Install and configure

From the web repository root:

```sh
npm ci
cp .env.example .env
npx prisma generate
```

Edit `.env` with development values. Required for web/database flows: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL` and the Supabase publishable/anon key. Mobile authentication also requires a strong server-only `JWT_SECRET`.

AI, Telegram, LiveKit, mail and analytics are optional integrations. Only configure them when working on that feature. Values prefixed `NEXT_PUBLIC_` can reach the browser; never put a secret there. The example file contains placeholders, not working credentials.

## Database initialization

Before any schema command, verify the target database is a disposable development database. For a new database, review the migration history, then apply the migrations:

```sh
npx prisma migrate deploy
```

For an existing database, inspect migration status and any schema drift first. An existing database created through manual SQL may require a baseline or reconciliation; do not mark migrations applied without checking their actual changes. Do not run the seed command automatically: seed tools may create or overwrite records. Never run `db push`, `migrate reset` or a production seed as a generic installation step.

Web sign-in also needs a corresponding Supabase user and school/admin membership. A successful database migration alone does not provision a usable authenticated school account; coordinate development account setup with the maintainer.

## Run and check

```sh
npm run dev
npm run typecheck
npm run lint
npm run test:imports
```

The default local URL is `http://localhost:3000`. Production-like builds use `npm run build`, then `npm start`. Live credentials and data are not required for the offline import-rule checks.

## PDF worker locally

Create a local virtual environment and install `requirements.txt`. Point `STUDENT_PDF_PYTHON` at its executable; the current development default is `tmp/pdf-import-venv/bin/python3`. On Vercel, `api/student_pdf.py` uses the Python runtime and root requirements file; it is not launched from a Node virtual environment.

## Troubleshooting

| Symptom | Check |
|---|---|
| Prisma says a table/column is missing | Database migrations and actual deployed schema; generating Client is insufficient |
| Parent login fails | Account access status, password setup, `JWT_SECRET` and `MobileRateLimit` table |
| PDF worker returns HTML | Deployment protection/routing; the internal worker requires a signed server request |
| Students appear absent after import | Query error vs genuine zero results, tenant scope, class filter and cached data |
| Optional integration is unavailable | Its environment variables and provider setup; avoid enabling unrelated services |

Deployment configuration lives in `vercel.json` and `next.config.js`/`next.config.mjs`. Inspect both before changing configuration; consolidating them is a separate runtime change.
