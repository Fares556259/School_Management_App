import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { getExpenseNature } from '../lib/expenseNature';
import { getLast6Months, groupByMonth } from '../lib/financeChartData';
import { withDatabaseReadRetry } from '../lib/databaseReadRetry';
import { parseSchoolDay } from '../lib/schoolDay';
import { middleware } from '../middleware';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/mobileAuth';
import { GET } from '../app/api/mobile/teacher/students/route';
import { POST } from '../app/api/mobile/teacher/attendance/route';
import { GET as getAdminProfile } from '../app/api/mobile/admin/profile/route';

async function main() {
  assert.equal(getExpenseNature({ title: 'Salaire: Octobre' }), 'salary');
  assert.equal(getExpenseNature({ category: 'AVANCE' }), 'advance');
  assert.equal(getExpenseNature({ title: 'Supplies' }), 'operation');
  assert.deepEqual(groupByMonth([{ date: new Date(2026, 9, 4), amount: 10 }, { date: new Date(2026, 9, 5).toISOString(), amount: 25 }]), { 'Oct 2026': 35 });
  assert.deepEqual(getLast6Months(new Date(2026, 2, 31)), ['Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026']);
  assert.equal(parseSchoolDay('2026-10-04')?.day, null);
  assert.equal(parseSchoolDay('2026-10-05')?.day, 'MONDAY');
  assert.equal(parseSchoolDay('2028-02-29')?.date.toISOString(), '2028-02-29T00:00:00.000Z');
  for (const invalid of ['2026-02-29', '2026-13-01', 'bad', '', '2026-10-05T00:00:00Z', 123]) assert.equal(parseSchoolDay(invalid), null);
  let reads = 0;
  const recoveringRead = withDatabaseReadRetry('findMany', async () => { if (++reads === 1) throw { code: 'P1017' }; return 'recovered'; });
  const healthyRead = withDatabaseReadRetry('count', async () => 42);
  assert.deepEqual(await Promise.all([recoveringRead, healthyRead]), ['recovered', 42]);
  assert.equal(reads, 2);
  for (const [operation, error] of [['create', { code: 'P1017' }], ['update', { code: 'P1001' }], ['findMany', { code: 'P2024' }], ['findMany', { message: 'ECHECKOUTTIMEOUT' }], ['findMany', { code: 'P2002' }]] as const) {
    let calls = 0;
    await assert.rejects(withDatabaseReadRetry(operation, async () => { calls++; throw error; }));
    assert.equal(calls, 1);
  }
  let permanent = 0;
  await assert.rejects(withDatabaseReadRetry('count', async () => { permanent++; throw { code: 'P1017' }; }));
  assert.equal(permanent, 2, 'A persistent outage has a bounded retry');

  const originalSecret = process.env.JWT_SECRET;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.JWT_SECRET = 'runtime-test-secret-with-at-least-32-characters';
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originals: Array<() => void> = [];
  const replace = (model: any, method: string, fn: any) => { const original = model[method]; originals.push(() => { model[method] = original; }); model[method] = fn; };
  let slotReads = 0, classReads = 0, denied = false;
  replace(prisma.class, 'findFirst', async (args: any) => {
    classReads++;
    assert.deepEqual(args.where, { id: 111, schoolId: 'school-a' });
    return denied ? null : { id: 111 };
  });
  replace(prisma.student, 'findMany', async (args: any) => {
    assert.deepEqual(args.where, { classId: 111, schoolId: 'school-a' });
    return [{ id: 'child-a', name: 'Child', surname: 'A', img: null }];
  });
  replace(prisma.lesson, 'findMany', async (args: any) => {
    assert.equal(args.where.day, 'MONDAY'); assert.equal(args.where.schoolId, 'school-a'); return [];
  });
  replace(prisma.timetableSlot, 'findMany', async (args: any) => {
    slotReads++;
    assert.equal(args.where.day, 'MONDAY'); assert.equal(args.where.schoolId, 'school-a');
    if (args.where.OR) assert.equal(args.where.OR[0].teacherId, 'teacher-a');
    return [];
  });
  replace(prisma.teacher, 'findUnique', async () => ({ schoolId: 'school-a', name: 'Teacher', surname: 'A' }));
  let adminProfileReads = 0;
  replace(prisma.admin, 'findFirst', async (args: any) => {
    adminProfileReads++;
    assert.deepEqual(args.where, { id: 'admin-a', schoolId: 'school-a', status: 'active' });
    return { id: 'admin-a', name: 'Admin', surname: 'A', username: 'admin', email: null, phone: null, img: null, School: { name: 'Synthetic school' } };
  });
  const token = generateToken({ userId: 'teacher-a', userType: 'teacher', schoolId: 'school-a' });
  const request = (query: string) => new NextRequest(`https://example.com/api/mobile/teacher/students?${query}`, { headers: { Authorization: `Bearer ${token}` } });
  try {
    for (const path of ['/', '/privacy', '/account-deletion']) {
      assert.equal((await middleware(new NextRequest(`https://example.com${path}`))).headers.get('x-middleware-next'), '1');
    }
    for (const query of ['classId=bad', 'classId=0', 'classId=111&date=invalid', 'classId=111&date=2026-02-30']) assert.equal((await GET(request(query))).status, 400);
    assert.equal(classReads, 0);
    let response = await GET(request('classId=111&date=2026-10-04'));
    assert.equal(response.status, 200);
    const sunday = await response.json();
    assert.equal(sunday.students.length, 1);
    assert.deepEqual(sunday.sessions, []);
    assert.equal(sunday.hasLesson, false);
    assert.equal(slotReads, 0, 'Sunday must not reach any Day enum query');
    response = await GET(request('classId=111&date=2026-10-05'));
    assert.equal(response.status, 200);
    assert.equal(slotReads, 1);
    denied = true;
    assert.equal((await GET(request('classId=111&date=2026-10-04'))).status, 404);
    assert.equal((await GET(request('classId=111&teacherId=another-teacher'))).status, 403);
    const adminToken = generateToken({ userId: 'admin-a', userType: 'admin', schoolId: 'school-a' });
    const adminRequest = (id = 'admin-a', bearer = adminToken) => new NextRequest(`https://example.com/api/mobile/admin/profile?id=${id}`, { headers: { Authorization: `Bearer ${bearer}` } });
    assert.equal((await getAdminProfile(new NextRequest('https://example.com/api/mobile/admin/profile'))).status, 401);
    assert.equal((await getAdminProfile(adminRequest('admin-a', token))).status, 403);
    assert.equal((await getAdminProfile(adminRequest('other-admin'))).status, 403);
    assert.equal(adminProfileReads, 0, 'Rejected profile requests must not query the database');
    const profileResponse = await getAdminProfile(adminRequest());
    assert.equal(profileResponse.status, 200);
    assert.equal(profileResponse.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(await profileResponse.json(), { id: 'admin-a', name: 'Admin', surname: 'A', username: 'admin', email: null, phone: null, img: null, schoolName: 'Synthetic school' });
    assert.equal(adminProfileReads, 1);
    for (const date of ['2026-10-04', 'bad']) {
      const response = await POST(new NextRequest('https://example.com/api/mobile/teacher/attendance', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: 'teacher-a', classId: 111, records: [], date }),
      }));
      assert.equal(response.status, 400, 'Invalid and non-teaching dates must be rejected before attendance writes');
    }
    console.log('Runtime stability checks passed: server-safe finance helpers, cached chart dates, month boundaries, bounded read-only recovery, Sunday roster and attendance, validated inputs, school scoping and public pages without auth refresh.');
  } finally {
    originals.reverse().forEach(restore => restore());
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
    if (originalUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
