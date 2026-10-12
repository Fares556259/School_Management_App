import assert from 'node:assert/strict';
import prisma from '../lib/prisma';
import { createAttendanceNotificationsBatch } from '../lib/notifications';

async function main() {
  const restores: Array<() => void> = [];
  const replace = (model: any, method: string, implementation: any) => {
    const original = model[method];
    restores.push(() => { model[method] = original; });
    model[method] = implementation;
  };

  let created: any[] = [];
  replace(prisma.student, 'findMany', async (args: any) => {
    assert.deepEqual(args.where, { id: { in: ['student-a', 'other-school'] }, schoolId: 'school-a' });
    return [{ id: 'student-a', name: 'Amine', parentId: 'parent-a', schoolId: 'school-a' }];
  });
  replace(prisma.notification, 'createMany', async (args: any) => {
    created = args.data;
    return { count: args.data.length };
  });
  replace(prisma.parent, 'findMany', async (args: any) => {
    assert.deepEqual(args.where, { id: { in: ['parent-a'] }, schoolId: 'school-a' });
    return [{ id: 'parent-a', expoPushToken: null }];
  });

  try {
    const result = await createAttendanceNotificationsBatch(
      [
        { studentId: 'student-a', status: 'LATE' },
        { studentId: 'other-school', status: 'ABSENT' },
      ],
      new Date('2026-10-12T00:00:00.000Z'),
      null,
      { schoolId: 'school-a', subjectName: 'Mathématiques', startTime: '08:00' }
    );
    assert.equal(created.length, 1, 'Only a student in the authenticated school gets an alert');
    assert.equal(created[0].parentId, 'parent-a', 'The alert targets the student’s assigned parent');
    assert.match(created[0].message, /08:00/, 'The school wall-clock session time is preserved');
    assert.deepEqual(result, { notificationsCreated: 1, pushTokensCount: 0, pushSentCount: 0 });
    console.log('Attendance notification checks passed: exact parent, tenant scope, stable session time, and awaited delivery result.');
  } finally {
    restores.reverse().forEach((restore) => restore());
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
