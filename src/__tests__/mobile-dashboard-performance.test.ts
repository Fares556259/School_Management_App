import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/mobileAuth';
import { GET } from '../app/api/mobile/admin/dashboard/route';
import { middleware } from '../middleware';

async function main() {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'dashboard-test-secret-at-least-32-characters';
  const token = generateToken({ userId: 'admin-a', userType: 'admin', schoolId: 'school-a' });
  const request = (query = '', bearer: string | null = token) => new NextRequest(`https://example.com/api/mobile/admin/dashboard${query}`, {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  });
  const originals: Array<() => void> = [];
  const pending: Array<() => void> = [];
  let calls = 0;
  let hold = true;
  const replace = (model: any, method: string, implementation: (...args: any[]) => any) => {
    const original = model[method];
    originals.push(() => { model[method] = original; });
    model[method] = (...args: any[]) => {
      calls++;
      const value = implementation(...args);
      return hold ? new Promise(resolve => pending.push(() => resolve(value))) : Promise.resolve(value);
    };
  };
  const scoped = (value: any) => (args: any) => { assert.equal(args.where.schoolId, 'school-a'); return value; };
  replace(prisma.admin, 'findUnique', args => { assert.equal(args.where.id, 'admin-a'); return { name: 'Admin', surname: 'A', username: 'a' }; });
  replace(prisma.school, 'findUnique', args => { assert.equal(args.where.id, 'school-a'); return { name: 'Synthetic school' }; });
  replace(prisma.student, 'count', scoped(3));
  replace(prisma.teacher, 'count', scoped(2));
  replace(prisma.staff, 'count', scoped(1));
  replace(prisma.class, 'count', scoped(1));
  replace(prisma.payment, 'aggregate', args => {
    assert.equal(args.where.schoolId, 'school-a'); assert.equal(args.where.month, 10); assert.equal(args.where.year, 2026);
    return { _sum: { amount: 350 } };
  });
  replace(prisma.attendance, 'count', args => { assert.equal(args.where.schoolId, 'school-a'); return args.where.status ? 1 : 10; });
  replace(prisma.attendance, 'findMany', scoped([{ id: 9, date: new Date('2026-10-04T08:00:00Z'), student: { name: 'Child', surname: 'A', class: { name: '1A' } } }]));
  replace(prisma.notice, 'findMany', scoped([]));
  replace(prisma, '$queryRaw', (parts, ...values) => {
    assert(values.includes('school-a'), 'Every raw financial query must stay school scoped');
    const sql = parts.join('');
    if (sql.includes('expectedTotal')) return [{ expectedTotal: 900 }];
    assert(values.includes(10)); assert(values.includes(2026));
    if (sql.includes('FROM "Student"')) return [{ id: 'child-a', name: 'Child', surname: 'A', tuitionFee: 300, paymentStatus: 'PARTIAL', paidAmount: 100, deferredAmount: 200, className: '1A', pName: 'Parent', pSurname: 'A', parentPhone: '22 222 222' }];
    if (sql.includes('FROM "Teacher"')) return [{ id: 'teacher-a', name: 'Teacher', surname: 'A', hourlyRate: 20, hoursPerMonth: 10, missedHours: 2, paymentStatus: 'PARTIAL', paymentAmount: 30 }];
    return [];
  });
  try {
    assert.equal((await GET(request('', null))).status, 401);
    const parent = generateToken({ userId: 'parent-a', userType: 'parent', schoolId: 'school-a' });
    assert.equal((await GET(request('', parent))).status, 403);
    for (const query of ['?month=bad', '?month=13', '?month=0', '?year=NaN', '?year=-1', '?year=2026.5']) {
      assert.equal((await GET(request(query))).status, 400);
    }
    assert.equal(calls, 0, 'Invalid and unauthorized requests must not query the database');
    const result = GET(request('?month=10&year=2026'));
    assert.equal(calls, 15, 'Independent dashboard reads should all start before any settles');
    pending.forEach(resolve => resolve());
    const response = await result;
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    const data = await response.json();
    assert.deepEqual(data.operations, { students: 3, teachers: 2, staff: 1, classes: 1 });
    assert.equal(data.adminName, 'Admin A'); assert.equal(data.monthLabel, 'Octobre 2026');
    assert.deepEqual(data.financialPulse, { collectedTuition: 350, expectedTuition: 900, remainingToCollect: 550, collectionRate: 39, monthLabel: 'Octobre 2026' });
    assert.equal(data.allUnpaid[0].dueAmount, 200);
    assert.equal(data.allUnpaid[0].parentPhone, '22222222');
    assert.equal(data.allUnpaid[1].dueAmount, 130);
    assert.equal(data.attendanceToday.attendanceRate, 90);
    assert.equal(data.attendanceToday.recentAbsentees[0].studentName, 'Child A');
    hold = false;
    assert.equal((await GET(request('?month=10&year=2026'))).status, 200);
    assert.equal(calls, 30, 'A refresh must read fresh finances, not a new response cache');
    // No Supabase configuration is required for mobile middleware pass-through.
    const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      const next = await middleware(request());
      assert.equal(next.headers.get('x-middleware-next'), '1');
    } finally {
      if (oldUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    }
    console.log('Dashboard checks passed: 15 independent reads, unchanged financial/attendance response, fresh refreshes, input validation, school scoping and mobile middleware without web auth.');
  } finally {
    originals.reverse().forEach(restore => restore());
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
