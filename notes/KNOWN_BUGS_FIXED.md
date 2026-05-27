# KNOWN_BUGS_FIXED.md — SnapSchool
> Last updated: 2026-05-27

This file tracks all bugs that have been identified and fixed. Every entry is permanent and must not be deleted. Before modifying any area of the codebase, check this file first.

---

## Bug #001 — Prisma Client Engine Crash

**Status:** Fixed (historically, before formal tracking)
**Date:** Pre-2026-05-27 (discovered in commit history)

**Root Cause:**
Prisma's "client engine" mode was failing in development, likely due to incompatibility with the deployment environment or a version mismatch.

**Fix Applied:**
Downgraded to Prisma 6 and explicitly set `engineType = "library"` in `schema.prisma` generator block. This forces the native Rust query engine instead of the WASM-based client engine.

**Files Modified:**
- `SnapSchool_Web/prisma/schema.prisma` (generator block)
- `SnapSchool_Web/src/lib/prisma.ts` (singleton with explicit datasource config)

**Critical Note:**
Do NOT upgrade Prisma without testing the engine type. The comment in `prisma.ts` explicitly warns about this. The `engineType = "library"` line in `schema.prisma` is load-bearing.

**Regression Risk:**
- Any `npm update` that bumps Prisma could reintroduce this
- Changing the generator block could switch back to client engine

**Verification:**
- [x] `npx prisma generate` succeeds
- [x] Dev server connects to database without engine errors

---

## Bug #002 — WebSocket Upgrade Errors in Dev Console

**Status:** Known / Not-a-bug (benign)
**Date:** 2026-05-27

**Root Cause:**
When Expo Metro Bundler and Next.js dev server run simultaneously, the Expo client (iOS/Android) sometimes sends WebSocket upgrade requests (for hot-reload) to the Next.js server at port 3000 instead of the Metro server at port 8082. Next.js cannot handle React Native's upgrade protocol and logs `TypeError: Cannot read properties of undefined (reading 'bind')`.

**Fix Applied:**
None needed. This is a development-only artifact caused by `EXPO_PUBLIC_API_URL=http://127.0.0.1:3000` in the mobile `.env`. The errors do not affect web or mobile functionality.

**Files Modified:**
- None

**Critical Note:**
Do NOT attempt to "fix" these errors by modifying the Next.js middleware matcher or the upgrade handler. They are harmless.

**Regression Risk:**
- None — this is informational only

**Verification:**
- [x] Web dashboard loads and serves pages with HTTP 200
- [x] Mobile app connects to Metro and functions correctly

---

*Add new entries below this line. Use sequential Bug IDs.*
