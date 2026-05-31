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

---

## Bug #003 — AI Exam Scheduler ReferenceError & Prisma Schema Caching

**Status:** Fixed
**Date:** 2026-05-28

**Root Cause:**
1. **ReferenceError (`generateExamsFromPrompt is not defined`):** The `generateExamsFromPrompt` AI scheduler action was implemented inside `src/app/(dashboard)/admin/actions/examAiActions.ts`, but its import statement was omitted from the top of the client playground component `ExamTimetableClient.tsx` during its recent overhaul.
2. **Prisma Client ValidationError (`Unknown argument isDraft`):** The database schema was successfully extended with the `isDraft` boolean column on the `Exam` model and pushed via `npx prisma db push`, but the local `node_modules` Prisma Client was outdated and cached inside Next.js dev server memory.

**Fix Applied:**
1. Added the missing import for `generateExamsFromPrompt` from `../../admin/actions/examAiActions` at the top of `src/app/(dashboard)/list/exams/ExamTimetableClient.tsx`.
2. Regenerated the Prisma Client using `npx prisma generate` to rebuild the typed interface file structure with the new `isDraft` schema properties.
3. Notified the Next.js dev server of client changes.

**Files Modified:**
- `src/app/(dashboard)/list/exams/ExamTimetableClient.tsx` (Added import on line 24)

**Critical Note:**
If schema edits are pushed to the database in the future, always run `npx prisma generate` immediately to sync the localized typings in `node_modules`.

**Verification:**
- [x] Prisma client successfully regenerated with `isDraft` support.
- [x] Missing imports added; no type errors in updated files during compilation check.
- [x] Successfully committed and pushed to `completed` branch.

---

## Bug #004 — Infinite Loading on Proof Preview (Next.js Image onLoad Race Condition)

**Status:** Fixed
**Date:** 2026-05-28

**Root Cause:**
Next.js's `<Image>` component wraps native `<img>` tags and binds a synthetic `onLoad` listener during React hydration. However, when an image is loaded instantly (e.g. from browser cache, memory cache, or dynamic blob URLs), the native browser `load` event fires **before** React can bind its synthetic event listeners. Consequently, the React `onLoad` prop never fires, causing `isImageLoading` to remain stuck at `true` infinitely.

*Secondary Race Condition:* If `isImageLoading` is successfully cleared but a subsequent database `sync` hook runs (triggered by class student roster or term updates), the code calls `setIsImageLoading(true)` again. However, if the `proofPreviewUrl` is identical to the previous one, the browser does not trigger a reload lifecycle, meaning `onLoad` is never called again, and since `proofPreviewUrl` didn't change, the cache-hit `useEffect` didn't run either. This resulted in an infinite loader overlay when navigating or updating grades.

**Fix Applied:**
1. Replaced the dynamic Next.js `<Image>` component inside the proof previewer viewport and the fullscreen preview modal with a standard HTML `<img>` tag. Standard HTML tags are lighter and perfectly suited for dynamic layout modifications (zoom, rotation).
2. Defined an `imgRef` pointing to the HTML `<img>` element.
3. Implemented a `useEffect` cache detector sentinel that listens to **both** `proofPreviewUrl` and `isImageLoading`. If `isImageLoading` is ever toggled to `true` while the image is already fully complete (`imgRef.current.complete === true`), it immediately intercepts and resets `isImageLoading(false)` on the next microtask.

**Files Modified:**
- `src/app/(dashboard)/admin/grades/GradeSheetRecorder.tsx`

**Critical Note:**
For highly dynamic file previews that load fast and support client-side controls (rotation, zoom), use standard HTML `<img>` tags coupled with a two-way reactive `[proofPreviewUrl, isImageLoading]` cached-hit verification sentinel effect.

**Verification:**
- [x] standard HTML `<img>` tags added with `imgRef` coverage.
- [x] `useEffect` reactive cache sentinel verified and implemented.
- [x] Compiles with zero errors.
- [x] Pushed successfully to git.

---

### Bug 18: Assignment Dropdown Displaying Duplicate/Fake "Lessons"

**Context:**
The "Lessons" feature was previously removed from the application, meaning users no longer manually create Lessons. However, Assignments and Exams are hardcoded via Prisma to require a valid `lessonId`. Because of this, the `AssignmentForm` and `ExamForm` had blank dropdowns or dropdowns filled with old, obsolete dummy data (like "Exam Lesson"). 

**Issue:**
When a teacher selected "All Classes", the dropdown showed dozens of duplicate lessons because the Timetable has multiple slots for the same class/subject across different days of the week. Furthermore, legacy database names like "Exam Lesson" appeared instead of proper formatting.

**Root Cause:**
1. The `/api/lessons` endpoint wasn't syncing `TimetableSlot` to `Lesson` cleanly.
2. The endpoint returned duplicate `Lesson` objects because a single course (e.g., Math 4C) meets multiple times a week.
3. The UI relied on the database `lesson.name`, which contained old test data.

**Fix Applied:**
1. **Auto-Sync:** Overhauled `/api/lessons/route.ts` to automatically map and synchronize active published `TimetableSlots` to the `Lesson` table, resolving foreign-key restrictions natively without requiring a massive database migration.
2. **Deduplication:** Added a grouping mechanism using a `Map` that deduplicates slots based on a unique `(subjectId, classId, teacherId)` combination, discarding day/time to ensure only 1 clean lesson is created/returned per course.
3. **Strict Filtering:** Ensured `/api/lessons` *only* returns `Lesson` entries whose IDs match the freshly verified/synced `TimetableSlots`, implicitly ignoring any obsolete/fake legacy data.
4. **Dynamic UI Formatting:** Updated `AssignmentForm.tsx` to completely ignore `lesson.name` and instead render the dropdown option dynamically using relational data: `{lesson.subject.name} ({lesson.class.name}) - {lesson.teacher.name} {lesson.teacher.surname}`.

**Files Modified:**
- `src/app/api/lessons/route.ts`
- `src/components/forms/AssignmentForm.tsx`

**Verification:**
- [x] Selecting "All Classes" shows a clean, 1-to-1 deduplicated list of active courses.
- [x] Old data (e.g., "Exam Lesson") is no longer displayed.
- [x] DB Foreign Keys remain intact.
- [x] Pushed successfully to git.
