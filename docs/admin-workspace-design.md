# Administrative workspace design

## Purpose and scope

The administrator already uses LaVieScolaire. SnapSchool now uses familiar visual density and the search → results → action sequence, while preserving its own identity and existing business workflows. This first implementation covers the shared admin shell, Classes directory and Students directory. It is not a complete redesign of every page and does not reproduce official government branding.

## Visual rules

- Navy `#273b68` for section headings and search actions; pale blue `#e5ecf7` for navigation, `#edf3f9` for alternate table rows.
- Arial/Tahoma system typography; 13px body/table text, 12px labels, 14px panel headings and 18px page titles. These are chosen reference-inspired values, not measured claims about the original site's font.
- 252px labeled desktop sidebar; logical start/end layout preserves Arabic RTL. No forced right sidebar for French/English.
- Compact bordered sections with small corners. Search options appear above results; result headings carry counts. Desktop controls are 36px, mobile form controls 44px.
- Visible focus outlines, real labels, semantic headings, accessible breadcrumbs and horizontally scrollable tables. Collapsed navigation sections are inert to keyboard focus.

The shared theme is scoped to `.ss-school-workspace` for the admin role. Public pages and other-role dashboard shells retain their theme. Classes/Students use the new panel components/styles in their shared route content, including when a teacher is allowed to visit them.

## Behavior

Classes: an explicit GET search form filters by class name and level; Reset returns to the directory. Level links allow quick browsing. Existing class details, assignment, teachers and CRUD routes remain in place. Removed the old filter/sort icon buttons because they did not perform actions.

Students: the form uses draft values, applied with Search, and Reset clears name/identifier, level, class and payment status. The month returns to the initially selected month. Applied filters are written to the URL and reset pagination. Filtering remains over the existing server-provided tenant/teacher-scoped dataset; this change does not broaden authorization or add database writes. Counts and payment summaries now share the same name/identifier/level/class predicate, including unassigned students. Payment status still narrows table results separately from the summary.

The parent A4 slips link uses the applied numeric class, so select a class and press Search. Import, student creation, details, editing, certificates, billing and app download remain available.

## Files and extension

- `src/app/globals.css`: scoped workspace theme and reusable `.school-*` panel/form classes.
- `src/lib/schoolWorkspaceCopy.ts`: shared FR/EN/AR text.
- `src/components/school-workspace/WorkspaceBreadcrumbs.tsx`: class/student route context.
- Dashboard layout, Navbar, Menu and DashboardShellClient: admin shell and navigation.
- `src/components/Table.tsx`: `.ss-table` hook; compact table rules apply only in the admin shell.
- Classes `page.tsx` and Students `StudentListClient.tsx`: feature layouts and explicit search forms.

Use the same search/results pattern when subsequently redesigning Attendance, Grades, Teachers or parent access. Preserve tenant checks, mutation review and domain logic; do not use a visual redesign to change enrollment or financial rules. New UI text must cover Arabic, French and English.

## Delivery evidence

TypeScript and focused lint were run; lint reports the pre-existing raw teacher avatar `<img>` warning on the Classes page. No browser, live account, payment, print or test-suite execution was performed, following the user's preference to test. No schema or deployment changes are included. The user should review Classes/Students on desktop, mobile and Arabic RTL before further rollout.
