import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/mobileAuth';
import { GET, PATCH } from '../app/api/mobile/students/route';

async function main() {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'students-test-secret-at-least-32-characters';
  const originalFind = prisma.parent.findFirst;
  const originalUpdate = prisma.student.update;
  let updateArgs: any;
  let denied = false;
  (prisma.parent as any).findFirst = async (args: any) => {
    assert.deepEqual(args.where, { id: 'parent-a', schoolId: 'school-a' });
    assert.deepEqual(args.include.students.where, { schoolId: 'school-a' });
    return { students: [{ id: 'child-a' }] };
  };
  (prisma.student as any).update = async (args: any) => {
    updateArgs = args;
    if (denied) throw { code: 'P2025' };
    return { id: 'child-a', name: 'Child' };
  };
  const request = (role: 'parent' | 'teacher' | 'admin', method: 'GET' | 'PATCH', body?: any) => {
    const token = generateToken({ userId: `${role}-a`, userType: role, schoolId: 'school-a' });
    return new NextRequest('https://example.com/api/mobile/students?parentId=parent-a', {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
  };
  try {
    assert.equal((await GET(new NextRequest('https://example.com/api/mobile/students'))).status, 401);
    assert.equal((await GET(request('teacher', 'GET'))).status, 403);
    const children = await GET(request('parent', 'GET'));
    assert.equal(children.status, 200);
    assert.equal(children.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(await children.json(), [{ id: 'child-a' }]);
    for (const role of ['parent', 'teacher', 'admin'] as const) {
      denied = false;
      const success = await PATCH(request(role, 'PATCH', { id: 'child-a', name: 'Child', schoolId: 'school-b', parentId: 'parent-b' }));
      assert.equal(success.status, 200);
      assert.deepEqual(updateArgs.where, { id: 'child-a', schoolId: 'school-a', ...(role === 'parent' ? { parentId: 'parent-a' } : {}) });
      assert.deepEqual(updateArgs.data, { name: 'Child' });
      denied = true;
      assert.equal((await PATCH(request(role, 'PATCH', { id: 'child-from-other-school', img: 'test.png' }))).status, 403);
    }
    assert.equal((await PATCH(request('parent', 'PATCH', { id: 123 }))).status, 400);
    console.log('Student isolation checks passed: authenticated reads, school-scoped children, atomic school/parent guards for edits and normal authorized updates.');
  } finally {
    (prisma.parent as any).findFirst = originalFind;
    (prisma.student as any).update = originalUpdate;
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
