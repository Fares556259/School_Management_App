# Product and operations guide

For cofounders and partners. Last reviewed: 2026-11-20.

## Who uses SnapSchool

| User | Main responsibility | Relevant product area |
|---|---|---|
| School administrator | Maintain school records, organize classes, manage financial and academic operations, prepare family access | Web dashboard and admin APIs |
| Teacher | Work with assigned classes and teaching information | Teacher web/mobile routes for classes, attendance, resources, grades and tasks |
| Parent / guardian | Access information for linked children | Parent mobile account and child-specific data |
| Staff member | Be represented in school personnel and salary operations | Personnel and payment records; this does not imply every staff member has an independent login |
| Project team | Maintain software, release changes and support school onboarding | Repositories, deployment, migrations and documentation |

Routes and database models establish the presence of these areas. They do not establish full acceptance of every screen. See the current-state handoff for known limits.

## Product areas

| Area | Business purpose | Where it appears |
|---|---|---|
| People | Keep students, families, teachers and staff connected to the correct school | Students, Parents, Teachers and Staff |
| Academic organization | Organize levels, classes, subjects, timetables and assessments | Classes, timetable, exams, results and report-card code |
| Attendance | Record and expose attendance information and supporting workflows | Attendance APIs, student profile and teacher flows |
| Finance | Track student charges/payments, receipts, expenses, income and personnel payments | Finance screens and billing modules |
| Communication | Surface announcements, notifications and parent access requests | Web/mobile routes and notification integrations |
| Assistant | Support conversational school operations through Hnia and integrations | Assistant page, mobile agent endpoints, Telegram and voice code |
| Documents | Produce school documents and printable outputs | PDF/Excel/Word/report-card modules and parent slips |

Business rules differ by area. A parent access status is not a tuition payment status, and a student without a class is not necessarily an absent database record.

## Important vocabulary

- **School / tenant:** the organizational boundary. Records and actions must remain scoped to the correct school.
- **Level:** pedagogical grade, including preparatory level 0. It is not an individual classroom.
- **Class:** a concrete group such as 1A. One level can have several classes.
- **Student identifier:** an identifier stored as text, preserving leading zeros. It is different from a class database ID.
- **Parent / responsible guardian:** one account linked to one or more children, including children in different classes.
- **Staging / review:** extracted information awaiting explicit import. Exporting a review file does not create accounts.
- **Access status:** whether an account is eligible for access. It does not indicate whether tuition is paid.
- **Migration:** a database structure change. Shipping application code does not itself prove the database received that change.

## Bringing a school onto the system

### 1. Prepare the school and administrator

Provision the school and an authorized administrator in the correct environment. Database setup alone does not create a usable Supabase login and school membership. Confirm which school the administrator is operating in before importing data.

### 2. Import the student register

The strict PDF importer extracts records deterministically with Python/PyMuPDF. It preserves original values and source evidence for review. The administrator reviews the expected total and conflicts before requesting creation of students and guardians.

Birthdays are optional. Missing birthdays should remain missing; the system should not invent dates. Guardian grouping uses the exact guardian name and phone in the preparation rules. Ambiguous or conflicting information requires correction rather than an automatic merge.

The import is transactional: related writes should succeed together or fail together. Matching existing students are skipped; inconsistent existing records block the import. Repeating an import is therefore not intended to create a second family for every child.

One historical school register contained 498 students over 33 pages, with 378 guardian groups. These are evidence from that onboarding exercise, not hardcoded product limits or expected totals for other schools.

### 3. Assign students to their exact classes

Create/select the actual target class and use its assignment workflow. Paste the list for that one class from LaVieScolaire, preferably including unique identifiers. Match records already present in SnapSchool, review anomalies and confirm the expected count.

A PDF containing three classes may contain many more students than one page shows. For example, 61 identified students cannot be confirmed as a 21-student class by simply changing the expected count. The input must represent the intended class. The expected-count check protects this boundary.

The paste-list flow does not silently move pupils from another class and does not remove pupils already in the target class. Class capacity and level checks still apply. The older manual selection flow has different semantics; engineering must trace the active implementation when changing it.

### 4. Prepare parent mobile access

Open the target class's parent-access page, including through the class-filtered student list entry point. Review the child, guardian and phone mapping, then explicitly prepare the eligible accounts.

The requested distribution format is one cut-out slip per child, six slips per A4 page. The parent signs in with their phone and the eight-digit code in the password field. Children sharing the same parent record receive the same parent code, even across classes.

Preparing access can activate eligible passwordless accounts. Existing personal passwords are preserved. A slip cannot reveal a parent's existing private password; those cases require administrator assistance. Suspended or rejected accounts must not be activated through printing.

The administrator must deliver each slip to the correct child. Treat printed slips as private account access information. A duplicated parent record can defeat sibling consistency, so the family relationships must be reviewed before distribution.

### Additional children after sign-in

A parent can request a link to another student already registered in the same school. The Child-link requests inbox shows the requested child and the parent's existing children. Staff verify guardianship before approval. The same account and credentials are kept; refusing an extra-child request preserves existing ACTIVE access. Requests do not enroll a new student or transfer a child from another guardian. See the [current rollout guide](../parent-access-rollout.md) for the prepared database repair and verification limits.

### 5. Accept the rollout

The user previously chose to perform live testing themselves. Real credential preparation, parent login, password change and actual A4 pagination remain unverified in the recorded handoff. The team should record the result of each acceptance step with its environment and date. Do not tell a school that mobile onboarding is verified solely because the UI exists.

## Reliability and current delivery priorities

The following is a proposed order for planning, not a promise of completed work or a committed roadmap:

1. Reconcile production schema gaps recorded in [current state](../agents/current-state.md), especially parent requests and finance dependencies. Confirm current errors before choosing a repair.
2. Complete authorized parent onboarding acceptance: sibling links, eligible account preparation, phone/code login, personal password handling and cut-out A4 output.
3. Verify affected academic and financial flows against a consistent development/test schema before broader school rollout.
4. Continue extracting focused business modules from large shared files, with incremental caller updates and checks.
5. Improve release evidence and partner onboarding as new features become stable.

The recorded schema problems include StudentServiceAssignment, ParentAccessRequest, StudentChargeCategory and Payment.overtimeHours. The authoritative, dated status belongs in current-state; these should not be treated as permanently unresolved if later work repairs them.

## How partners should divide work

Agree explicit owners for product acceptance, technical implementation, database/deployment work, mobile releases and school support. These are suggested responsibilities; this document does not assign named people or assume current account ownership.

For each feature, the product owner defines the user outcome and examples; the engineer traces the implementation and proposes the change; the release owner records code and schema operations; the school-facing owner verifies the real workflow and communicates limits. One person may fill multiple roles, but the evidence should remain distinct.

For a parent-slip issue, a useful handoff is: which class, expected behavior, a redacted screenshot, environment, relevant commit, and whether access preparation actually ran. Never place phone/code pairs or identifiable student exports in an issue or public document.

## Commercial and ownership information not established here

Pricing, contracts, revenue, customer totals, service commitments, legal responsibilities and named infrastructure owners were not verified for this handbook. The cofounders should maintain those separately with the relevant evidence and access controls. Code presence alone does not answer those business questions.
