/** Explicit, create-only provisioning. No resets, upserts, email, or existing credential changes. */
import 'dotenv/config';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { open, unlink, writeFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserSex, AttendanceStatus } from '@prisma/client';

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const email = argument('--email') || 'demo.admin.20261122@example.test';
const expectedProject = argument('--expected-project');
const create = process.argv.includes('--create');

async function main() {
  if (!/^[a-z0-9.+_-]+@example\.test$/i.test(email)) throw new Error('DEMO_RESERVED_EMAIL_REQUIRED');
  if (!create) {
    console.log(JSON.stringify({ mode: 'plan-only', email, school: 'DEMO — École fictive',
      students: 12, parents: 8, classes: 3, teachers: 3, subjects: 3,
      note: 'Requires --create --expected-project <Supabase project ref>. Creates only; never resets existing data.' }));
    return;
  }
  const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!rawUrl || !expectedProject) throw new Error('DEMO_DATABASE_AND_EXPECTED_PROJECT_REQUIRED');
  const target = new URL(rawUrl);
  const authTarget = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://missing.invalid');
  if (![`${expectedProject}.supabase.co`, `${expectedProject}.supabase.com`].includes(authTarget.hostname) ||
      !(decodeURIComponent(target.username).endsWith(`.${expectedProject}`) || target.hostname === `db.${expectedProject}.supabase.co`)) {
    throw new Error('DEMO_DATABASE_PROJECT_MISMATCH');
  }
  target.searchParams.set('connect_timeout', '5');
  target.searchParams.set('pool_timeout', '5');
  const db = new PrismaClient({ datasources: { db: { url: target.toString() } } });
  const id = randomUUID();
  const schoolId = `isolated-demo-${id}`;
  const adminId = randomUUID();
  const tag = id.slice(0, 8);
  const adminPassword = `${randomBytes(15).toString('base64url')}!7a`;
  const parentCodes = Array.from({ length: 8 }, () => String(randomInt(10_000_000, 100_000_000)));
  const parentPhones = Array.from({ length: 8 }, (_, i) => `00031${String(i + 1).padStart(3, '0')}`);
  const hash = await bcrypt.hash(adminPassword, 12);
  const parentHashes = await Promise.all(parentCodes.map(code => bcrypt.hash(code, 12)));
  const credentialsPath = `/private/tmp/snapschool-demo-account-${tag}.txt`;
  let committed = false;
  // Reserve the private credential file before creating anything in the database.
  const secretFile = await open(credentialsPath, 'wx', 0o600);
  await secretFile.close();
  try {
    const result = await db.$transaction(async tx => {
      const baseline = await tx.$queryRaw<Array<{ students: bigint; parents: bigint; payments: bigint; schools: bigint }>>`
        SELECT (SELECT count(*) FROM public."Student") AS students,
          (SELECT count(*) FROM public."Parent") AS parents,
          (SELECT count(*) FROM public."Payment") AS payments,
          (SELECT count(*) FROM public."School") AS schools`;
      const existing = await tx.$queryRaw<Array<{ id: string }>>`SELECT id::text FROM auth.users WHERE lower(email)=lower(${email}) LIMIT 1`;
      if (existing.length) throw new Error('DEMO_EMAIL_EXISTS_NO_CHANGES_MADE');

      await tx.school.create({ data: { id: schoolId, name: 'DEMO — École fictive',
        subdomain: `demo-${tag}`, status: 'ACTIVE', plan: 'FREE', activatedAt: new Date(), updatedAt: new Date() }, select: { id: true } });
      await tx.$executeRaw`
        INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
          raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,
          email_change_token_new,email_change,phone_change,phone_change_token,email_change_token_current,
          reauthentication_token,is_sso_user,is_anonymous,is_super_admin)
        VALUES ('00000000-0000-0000-0000-000000000000'::uuid,${adminId}::uuid,'authenticated','authenticated',
          ${email},${hash},NOW(),${JSON.stringify({ provider: 'email', providers: ['email'], role: 'admin', status: 'active', schoolId, demo: true })}::jsonb,
          ${JSON.stringify({ firstName: 'Admin', lastName: 'Démonstration', accountPurpose: 'isolated-demo' })}::jsonb,
          NOW(),NOW(),'','','','','','','','',false,false,false)`;
      await tx.$executeRaw`
        INSERT INTO auth.identities (id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
        VALUES (${randomUUID()}::uuid,${adminId},${adminId}::uuid,
          ${JSON.stringify({ sub: adminId, email, email_verified: true, phone_verified: false })}::jsonb,'email',NULL,NOW(),NOW())`;
      await tx.admin.create({ data: { id: adminId, username: `demo-admin-${tag}`, email,
        name: 'Admin', surname: 'Démonstration', status: 'active', schoolId }, select: { id: true } });
      await tx.institution.create({ data: { schoolId, schoolName: 'DEMO — École fictive',
        address: 'Adresse fictive — aucune personne réelle', phone: '00000000',
        ministryName: 'Démonstration', universityName: 'Données fictives', academicYear: '2026-2027', currentSemester: 1,
        yearStart: new Date('2026-09-01T00:00:00Z'), yearEnd: new Date('2027-06-30T00:00:00Z'),
        halfBoundaryMonths: false, registrationFeeEnabled: false }, select: { id: true } });
      const levels = [];
      for (let level = 0; level <= 6; level++) levels.push(await tx.level.create({
        data: { schoolId, level, tuitionFee: 160 + level * 10 }, select: { id: true, level: true } }));
      const subjects = [];
      for (const name of ['Mathématiques — Démo', 'Français — Démo', 'العربية — تجريبي']) {
        subjects.push(await tx.subject.create({ data: { schoolId, name, domain: 'Démonstration' }, select: { id: true } }));
      }
      const teachers = [];
      for (let i = 0; i < 3; i++) teachers.push(await tx.teacher.create({ data: {
        id: `demo-teacher-${tag}-${i}`, username: `demo.teacher.${tag}.${i}`, name: ['Sonia', 'Mehdi', 'Rim'][i], surname: 'Démo',
        address: 'Adresse fictive', bloodType: '', sex: i === 1 ? UserSex.MALE : UserSex.FEMALE,
        birthday: new Date('1985-01-01T00:00:00Z'), salary: 1500 + i * 100, schoolId,
        subjects: { connect: [{ id: subjects[i].id }] },
      }, select: { id: true } }));
      const classes = [];
      for (const [index, name] of ['1A', '1B', '2A'].entries()) classes.push(await tx.class.create({ data: {
        name, schoolId, capacity: 25, supervisorId: teachers[index].id,
        levelId: levels[index === 2 ? 2 : 1].id,
      }, select: { id: true, levelId: true } }));
      const parents = [];
      for (let i = 0; i < 8; i++) parents.push(await tx.parent.create({ data: {
        id: `demo-parent-${tag}-${i}`, username: parentPhones[i], phone: parentPhones[i], name: ['Habib', 'Amal', 'Karim', 'Inès', 'Sami', 'Leïla', 'Nour', 'Walid'][i],
        surname: `Famille Démo ${i + 1}`, address: 'Adresse fictive — démonstration',
        password: parentHashes[i], accessStatus: 'ACTIVE', preferredLocale: 'fr', schoolId,
      }, select: { id: true } }));
      const students = [];
      const names = ['Ahmed', 'Ali', 'Yasmine', 'Aziz', 'Meriem', 'Omar', 'Lina', 'Adam', 'Salma', 'Youssef', 'Nour', 'Amine'];
      for (let i = 0; i < 12; i++) {
        const parentIndex = i < 8 ? Math.floor(i / 2) : i - 4;
        const targetClass = classes[i % 3];
        students.push(await tx.student.create({ data: {
          id: `demo-student-${tag}-${i}`, username: `demo.student.${tag}.${i}`,
          nationalId: `DEMO-${tag}-${String(i + 1).padStart(2, '0')}`,
          name: names[i], surname: `Famille Démo ${parentIndex + 1}`, schoolId,
          sex: [2, 4, 6, 8, 10].includes(i) ? UserSex.FEMALE : UserSex.MALE, address: 'Adresse fictive', bloodType: '', birthday: null,
          parentId: parents[parentIndex].id, classId: i < 10 ? targetClass.id : null, levelId: targetClass.levelId,
        }, select: { id: true } }));
      }
      await tx.grade.createMany({ data: students.flatMap((student, i) => subjects.map((subject, j) => ({
        schoolId, studentId: student.id, subjectId: subject.id, term: 1, score: 10 + ((i + j) % 11),
      }))) });
      await tx.attendance.createMany({ data: students.flatMap((student, i) => [19, 20].map(day => ({
        schoolId, studentId: student.id, date: new Date(`2026-11-${day}T08:00:00Z`),
        status: i === 5 && day === 20 ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
        note: 'Présence fictive — démonstration',
      }))) });
      await tx.notice.createMany({ data: [
        { schoolId, title: 'École de démonstration', message: 'Tous les noms, élèves et numéros de ce compte sont fictifs.', important: true },
        { schoolId, title: 'Réunion fictive', message: 'Exemple d’annonce pour la classe 1A.', classId: classes[0].id },
      ] });
      const counts = { students: await tx.student.count({ where: { schoolId } }), parents: await tx.parent.count({ where: { schoolId } }),
        classes: await tx.class.count({ where: { schoolId } }), teachers: await tx.teacher.count({ where: { schoolId } }),
        grades: await tx.grade.count({ where: { schoolId } }), attendance: await tx.attendance.count({ where: { schoolId } }) };
      const others = await tx.$queryRaw<Array<{ students: bigint; parents: bigint; payments: bigint; schools: bigint }>>`
        SELECT (SELECT count(*) FROM public."Student" WHERE "schoolId"<>${schoolId}) AS students,
          (SELECT count(*) FROM public."Parent" WHERE "schoolId"<>${schoolId}) AS parents,
          (SELECT count(*) FROM public."Payment" WHERE "schoolId"<>${schoolId}) AS payments,
          (SELECT count(*) FROM public."School" WHERE id<>${schoolId}) AS schools`;
      if (JSON.stringify(baseline, (_, v) => typeof v === 'bigint' ? v.toString() : v) !==
          JSON.stringify(others, (_, v) => typeof v === 'bigint' ? v.toString() : v)) throw new Error('DEMO_OUTSIDE_TENANT_COUNTS_CHANGED');
      if (counts.students !== 12 || counts.parents !== 8 || counts.grades !== 36 || counts.attendance !== 24) throw new Error('DEMO_INCOMPLETE_DATA');
      if (await tx.student.count({ where: { schoolId, parentId: parents[0].id } }) !== 2) throw new Error('DEMO_SIBLING_LINK_INVALID');
      return counts;
    }, { maxWait: 10_000, timeout: 45_000 });
    committed = true;
    await writeFile(credentialsPath, [
      'SnapSchool isolated demo — all school records are fictional',
      'Sign in: https://www.snapschool.academy/sign-in',
      `School ID: ${schoolId}`, `Admin email: ${email}`, `Admin password: ${adminPassword}`,
      '', 'Mobile parent example — select Parent:', `Phone: ${parentPhones[0]}`, `Password/code: ${parentCodes[0]}`,
      'Children: Ahmed and Ali, one shared parent account across classes.',
      '', '12 students (10 assigned, 2 unassigned), 8 parents, 3 classes, 3 teachers, 36 grades, 24 attendance records.',
      'No payments, receipts, emails, push notifications or real-school records were created/modified.',
    ].join('\n')+'\n', { mode: 0o600 });
    console.log(JSON.stringify({ created: true, schoolId, ...result, otherTenantsUnchanged: true, credentialsPath }));
  } catch (error) {
    if (!committed) await unlink(credentialsPath);
    throw error;
  } finally { await db.$disconnect(); }
}
main().catch((error: unknown) => {
  // Prisma errors may contain query arguments; never log generated credentials/hashes.
  const value = error as { code?: string; message?: string };
  console.error(value.message?.startsWith('DEMO_') ? value.message : `Demo provisioning failed (${value.code || 'unknown'}); no credentials printed.`);
  process.exitCode = 1;
});
