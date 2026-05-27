# requirements.md — SnapSchool

> Last updated: 2026-05-27

## Product Vision

SnapSchool is a comprehensive school management system that connects administrators, teachers, parents, and students through a unified platform. It handles academics, finance, communication, and AI-assisted administration.

---

## Functional Requirements

### FR-1: Authentication & Authorization

- [X] Web admins authenticate via Clerk (email/password)
- [X] Mobile users authenticate via phone number + password
- [X] Role-based access control: superadmin, admin, teacher, parent, student
- [X] Pending user status with admin approval workflow
- [X] New admin onboarding with school provisioning

### FR-2: Student Management

- [X] CRUD operations for students
- [X] Student linked to parent, class, level, and school
- [X] Student profile with photo, blood type, contact info
- [X] Student photo upload from mobile app

### FR-3: Class & Academic Structure

- [X] Levels (grade levels) with configurable tuition fees
- [X] Classes with capacity and teacher supervisor
- [X] Subjects linked to teachers
- [X] Timetable management with room assignment

### FR-4: Attendance

- [X] Daily attendance tracking (Present/Absent/Late)
- [X] Teacher marks attendance via mobile app per class session
- [X] Automatic parent notification on absence/lateness
- [X] Critical absence alerts when threshold exceeded
- [X] Attendance justification with photo upload
- [X] Attendance scoring per session

### FR-5: Grades & Assessments

- [X] Grade sheets per class/subject/term
- [X] AI-assisted grade extraction from uploaded documents
- [X] Grade proof URL (uploaded image)
- [X] Report card generation (PDF)
- [X] Exam period configuration

### FR-6: Financial Management

- [X] Student tuition payments (monthly, per academic year Sep-Jun)
- [X] Teacher salary payments
- [X] Staff salary payments
- [X] Partial payment and deferred amount tracking
- [X] Income and expense tracking (general ledger)
- [X] Payment reminders to parents (automated, with dedup)
- [X] Profitability scenario simulator
- [X] AI-powered financial insights (Zbiba)
- [X] Full audit trail for all financial operations

### FR-7: Communication

- [X] School notices (global, per-class, per-student)
- [X] Push notifications to parents via Expo
- [X] Notification types: Attendance, Payment, Announcement, Homework, Remark
- [X] In-app notification center with read/unread status
- [X] Teacher remarks on students

### FR-8: Tasks & Resources

- [X] Assignment creation and due dates
- [X] Task submission by students (with photo)
- [X] Resource/material sharing per class
- [X] Notifications on new tasks and resources

### FR-9: Mobile App (Parent View)

- [X] View children's daily schedule
- [X] View attendance history
- [X] View payment timeline
- [X] View announcements
- [X] Receive push notifications
- [X] Submit absence justifications
- [X] View exam results
- [X] Profile management

### FR-10: Mobile App (Teacher View)

- [X] View assigned classes
- [X] Mark attendance with scoring
- [X] Create tasks and resources
- [X] View task submissions

### FR-11: AI Features

- [X] Financial insights generation (OpenRouter/Gemini)
- [X] AI quota management per admin
- [X] Insights caching to reduce API costs
- [X] Grade extraction from uploaded images (Zbiba)

### FR-12: Multi-Tenancy

- [X] Multiple schools in single database
- [X] School-level data isolation via `schoolId`
- [X] School setup request workflow
- [X] Superadmin panel for cross-school management

---

## Non-Functional Requirements

### NFR-1: Performance

- Server action body size limit: 10MB
- Database connection pooling: `connection_limit=1` with 60s timeout
- AI insights caching to avoid repeated API calls
- In-flight request deduplication on mobile

### NFR-2: Security

- All API routes behind Clerk middleware (except `/api/mobile/*` which use custom auth)
- CORS headers configured for mobile access
- Upload proxy excluded from auth for mobile image loading
- Audit logging for all admin modifications
- Password hashing via bcryptjs

### NFR-3: Reliability

- 3-tier role resolution fallback (claims → API → DB)
- 4-tier school ID resolution fallback (DB → claims → API → default)
- Graceful error handling in notification sending (errors logged, not thrown)
- Prisma disconnect on process exit

### NFR-4: Maintainability

- TypeScript throughout both codebases
- Prisma schema as single source of truth for data model
- Centralized CRUD actions instead of scattered mutations
- Consistent API patterns for mobile endpoints
