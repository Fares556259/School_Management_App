# roadmap.md — SnapSchool
> Last updated: 2026-05-27

This roadmap is derived from analyzing the current codebase state, debug/repair endpoints, and patterns that suggest planned or in-progress work.

---

## Current Status: Production-Ready MVP
Both web and mobile apps are functional with core features complete. The system is live with real user data on Supabase.

---

## Observed In-Progress / Incomplete Areas

### 🔧 Debug & Repair Endpoints (likely temporary)
The following API routes exist under `/api/` and appear to be debug/repair utilities that should be cleaned up before a formal v2 release:
- `/api/debug/`
- `/api/debug-db/`
- `/api/debug-leads/`
- `/api/debug-parent/`
- `/api/debug-sync/`
- `/api/debug-users/`
- `/api/fix-names/`
- `/api/fix-real-names/`
- `/api/repair-user/`
- `/api/seed-mock/`
- `/api/seed-realistic/`
- `/api/check-users/`
- `/api/clerk-count/`

**Recommendation:** Audit and remove or gate behind superadmin auth before wider deployment.

### 📊 Finance Simulator
- `ProfitabilityScenario` model exists in schema
- `/admin/finance/simulator` route is defined
- Appears to be a what-if tool for financial planning

### 📧 Daily Reports
- `DailyReportLog` and `ReportSubscriber` models exist
- Likely a cron-based daily email report system
- `/api/cron/` endpoint exists

### 🏫 Superadmin Panel
- Route group `(superadmin)` exists
- `SetupRequest` model for school onboarding
- `/request-setup` and `/waiting-approval` pages

---

## Suggested Roadmap (for user to prioritize)

### Phase 1: Stabilization (Current)
- [ ] Remove or secure debug/repair API endpoints
- [ ] Audit CORS headers (currently `Access-Control-Allow-Origin: *`)
- [ ] Review mobile auth security (phone + password, no 2FA)
- [ ] Add rate limiting to mobile API endpoints
- [ ] Clean up `docker-compose.yml` (unused, may confuse contributors)

### Phase 2: Quality of Life
- [ ] Automated testing (currently no test suite detected)
- [ ] CI/CD pipeline for both web and mobile
- [ ] Error monitoring (Sentry or similar)
- [ ] Mobile app deep linking setup (the shared URI scheme warning in Expo)
- [ ] Image optimization (currently `unoptimized: true` in Next.js config)

### Phase 3: Feature Expansion
- [ ] Student-facing mobile view (currently students only visible through parent account)
- [ ] Multi-language support (translation infrastructure exists at `src/lib/translations/`)
- [ ] Offline mode for mobile app
- [ ] Parent-teacher messaging
- [ ] Automated report card generation on schedule

### Phase 4: Scale
- [ ] Increase database connection pool limits for production traffic
- [ ] Add Redis caching layer for frequently accessed data
- [ ] Optimize N+1 queries in notification processing
- [ ] Implement proper WebSocket for real-time updates (replace polling)

---

> **Note:** This roadmap was reconstructed from codebase analysis. The owner should review and adjust priorities based on actual product goals and user feedback.
