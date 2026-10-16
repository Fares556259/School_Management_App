import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { authenticateMobileRequest, generateToken, generateStudentClaimToken } from '../lib/mobileAuth';
import { reviewAccessRequest, submitAccessRequest, ParentAccessError } from '../lib/parentAccess';
import { getParentAccessAdmin } from '../lib/parentAccessAdmin';
import { flushAccessNotifications } from '../lib/parentAccessNotifications';
import { checkPersistentRateLimit } from '../lib/mobileRateLimit';
import { POST as signup } from '../app/api/mobile/auth/route';
import { GET as notificationInbox } from '../app/api/mobile/notifications/route';
import { GET as accessStatus, PATCH as updateAccessProfile } from '../app/api/mobile/parent/access/route';
import { POST as requestChild } from '../app/api/mobile/students/route';
import { GET as announcements } from '../app/api/mobile/announcements/route';
import { POST as verifyStudent } from '../app/api/mobile/student/verify/route';

async function main() {
  const secret = process.env.JWT_SECRET; process.env.JWT_SECRET = 'parent-access-test-secret-with-32-characters';
  const restores: (() => void)[] = [];
  const replace = (model: any, method: string, value: any) => { const old = model[method]; model[method] = value; restores.push(() => { model[method] = old; }); };
  const token = generateToken({ userId: 'parent-a', userType: 'parent', schoolId: 'school-a' });
  const req = (path: string, method = 'GET', body?: any, authenticated = true) => new NextRequest(`https://example.com/api/mobile/${path}`, {
    method, headers: { ...(authenticated ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let parentStatus: string | null = 'PENDING';
  replace(prisma.parent, 'findFirst', async (args: any) => {
    assert.equal(args.where.schoolId, 'school-a');
    if (!parentStatus) return null;
    if (args.select?.accessRequests) return { accessStatus: parentStatus, name: 'Test', phone: '20000000', School: { name: 'School' }, accessRequests: [
      { id: 'request-a', status: 'PENDING', relation: 'guardian', reason: null, createdAt: new Date(), student: { nationalId: 'ID12345678' } },
    ] };
    return { id: 'parent-a', accessStatus: parentStatus };
  });
  replace(prisma.parentAccessDelivery, 'findMany', async () => []);
  replace(prisma.parent, 'updateMany', async () => ({ count: 1 }));
  replace(prisma.mobileRateLimit, 'upsert', async () => ({ count: 1 }));
  try {
    for (const status of ['PENDING', 'REJECTED']) {
      parentStatus = status;
      const auth = await authenticateMobileRequest(req('courses'));
      assert.equal(auth.error?.status, 403);
      assert.equal((await auth.error!.json()).code, 'PARENT_APPROVAL_REQUIRED');
    }
    assert.equal((await authenticateMobileRequest(req('parent/access'), { allowPendingParent: true })).error, null);
    parentStatus = null;
    assert.equal((await authenticateMobileRequest(req('courses'))).error?.status, 401);
    parentStatus = 'PENDING';
    for (const route of ['courses', 'home', 'results', 'payments', 'parent/files', 'parent-data', 'school', 'attendance/history', 'tasks/submit']) {
      const handler = await import(`../app/api/mobile/${route}/route`);
      assert.equal((await handler.GET(req(route))).status, 403, `Pending parent cannot read ${route}`);
    }
    assert.equal((await announcements(req('announcements'))).status, 403);
    assert.equal((await accessStatus(req('parent/access'))).status, 200);
    const ownStatus = await (await accessStatus(req('parent/access'))).json();
    assert.equal(ownStatus.requests[0].reference, '••••5678');
    assert.equal('student' in ownStatus.requests[0], false);
    assert.equal(JSON.stringify(ownStatus).includes('ID12345678'), false);

    // Anonymous identifier verification returns only a request token and a masked reference.
    replace(prisma.student, 'findMany', async () => [{ id: 'student-a', parentId: 'someone-else', schoolId: 'school-a', School: { status: 'ACTIVE', name: 'School' } }]);
    const verified = await (await verifyStudent(req('student/verify', 'POST', { nationalId: 'ID12345678' }, false))).json();
    assert.equal(verified.success, true);
    assert.deepEqual(Object.keys(verified.student).sort(), ['reference', 'schoolName']);

    // Registration creates credentials and requests, never student ownership.
    let createdParent: any; const createdRequests: any[] = []; let ownershipWrites = 0;
    const signupTx: any = {
      parent: { findFirst: async () => null, create: async ({ data }: any) => { createdParent = data; return data; } },
      student: { findMany: async () => [{ id: 'student-a' }], findFirst: async () => ({ id: 'student-a', parentId: null }), updateMany: async () => { ownershipWrites++; return { count: 1 }; } },
      parentAccessRequest: { findUnique: async () => null, upsert: async ({ create }: any) => { createdRequests.push(create); return { id: 'request-new' }; } },
    };
    replace(prisma, '$transaction', async (fn: any) => fn(signupTx));
    const signupResponse = await signup(req('auth', 'POST', { action: 'signup', approvalFlowVersion: 1, role: 'parent', phone: '+216 20 000 000', parentName: 'Test', parentSurname: 'Parent', password: 'StrongPass123', relation: 'mother', locale: 'ar', claimTokens: [generateStudentClaimToken('student-a', 'school-a')] }, false));
    const account = await signupResponse.json(); assert.equal(signupResponse.status, 200);
    assert.equal(account.accessStatus, 'PENDING'); assert.deepEqual(account.students, []); assert.equal(account.pendingApproval, true);
    assert.equal(createdParent.phone, '20000000'); assert.equal(createdParent.accessStatus, 'PENDING');
    assert.equal(await bcrypt.compare('StrongPass123', createdParent.password), true);
    assert.equal(createdRequests[0].relation, 'mother'); assert.equal(ownershipWrites, 0);
    assert.equal((await requestChild(req('students', 'POST', { studentId: 'ID12345678', approvalFlowVersion: 1 }))).status, 200);
    assert.equal(ownershipWrites, 0, 'Additional-child request cannot link immediately');
    assert.equal((await requestChild(req('students', 'POST', { studentId: 'ID12345678' }))).status, 426, 'Older clients must update before sending an access request');

    // Repeated submission is idempotent; a rejected request can be corrected.
    signupTx.parentAccessRequest.findUnique = async () => ({ id: 'existing-request', status: 'PENDING' });
    assert.deepEqual(await submitAccessRequest(signupTx, 'parent-a', 'school-a', 'student-a', 'guardian'), { requestId: 'existing-request', pendingApproval: true });

    // Approval, rejection and revocation persist audit + notification atomically.
    let entry: any; let statusUpdates: any[] = []; let notifications: any[] = []; let audits: any[] = []; let deliveries: any[] = [];
    let linkedTo: string | null = null; let loseCAS = false; let conflicts = 0;
    const makeEntry = () => ({ id: 'request-a', parentId: 'parent-a', studentId: 'student-a', schoolId: 'school-a', status: 'PENDING', parent: { schoolId: 'school-a', preferredLocale: 'ar' }, student: { schoolId: 'school-a', nationalId: 'ID12345678' } });
    entry = makeEntry();
    const reviewTx: any = {
      $queryRaw: async () => [{ id: 'parent-a' }],
      parentAccessRequest: {
        findFirst: async ({ where }: any) => where.schoolId === entry.schoolId ? structuredClone(entry) : null,
        updateMany: async ({ where, data }: any) => { if (loseCAS || entry.status !== where.status) return { count: 0 }; Object.assign(entry, data); return { count: 1 }; },
        count: async (args: any) => args.where.parentId?.not ? conflicts : 0,
      },
      student: {
        updateMany: async ({ where, data }: any) => { if (where.OR && linkedTo && linkedTo !== 'parent-a') return { count: 0 }; linkedTo = data.parentId; return { count: 1 }; },
        count: async () => linkedTo ? 1 : 0,
      },
      parent: { update: async (args: any) => { statusUpdates.push(args.data.accessStatus); return args; } },
      auditLog: { create: async (args: any) => { audits.push(args.data); return args; } },
      notification: { create: async (args: any) => { notifications.push(args.data); return { id: notifications.length }; } },
      parentAccessDelivery: { updateMany: async () => ({ count: 0 }), create: async (args: any) => { deliveries.push(args.data); return args; } },
    };
    replace(prisma, '$transaction', async (fn: any) => {
      const previous = structuredClone({ entry, linkedTo, statusUpdates, audits, notifications, deliveries });
      try { return await fn(reviewTx); } catch (error) { ({ entry, linkedTo, statusUpdates, audits, notifications, deliveries } = previous); throw error; }
    });
    const review = (action: 'APPROVE' | 'REJECT' | 'REVOKE', extras = {}) => reviewAccessRequest({ requestId: 'request-a', schoolId: 'school-a', adminId: 'admin-a', action, ...extras });
    assert.equal((await review('APPROVE')).status, 'APPROVED');
    assert.equal(linkedTo, 'parent-a'); assert.equal(statusUpdates.at(-1), 'ACTIVE');
    assert.equal(audits[0].performedBy, 'admin-a'); assert.equal(notifications.length, 1); assert.equal(deliveries[0].notificationId, 1);
    assert.equal(notifications[0].title, 'تم تفعيل حسابك');
    await assert.rejects(() => review('APPROVE'), (e: any) => e.code === 'ALREADY_REVIEWED');
    assert.equal(notifications.length, 1, 'A double approval must not duplicate notifications');
    await assert.rejects(() => review('REVOKE'), (e: any) => e.code === 'REASON_REQUIRED');
    await review('REVOKE', { reason: 'Identity must be checked again' }); assert.equal(linkedTo, null); assert.equal(statusUpdates.at(-1), 'REJECTED');
    entry = makeEntry(); linkedTo = 'parent-other';
    await assert.rejects(() => review('APPROVE'), (e: any) => e.code === 'CHILD_ALREADY_LINKED'); assert.equal(entry.status, 'PENDING');
    assert.equal(linkedTo, 'parent-other', 'Approving cannot transfer another family’s child');
    linkedTo = null; loseCAS = true;
    await assert.rejects(() => review('APPROVE'), (e: any) => e.code === 'ALREADY_REVIEWED'); assert.equal(linkedTo, null); loseCAS = false;
    conflicts = 1;
    await assert.rejects(() => review('APPROVE', { batch: true }), (e: any) => e.code === 'CONFLICT_REQUIRES_REVIEW'); conflicts = 0;
    await assert.rejects(() => reviewAccessRequest({ requestId: 'request-a', schoolId: 'school-b', adminId: 'admin-a', action: 'APPROVE' }), (e: any) => e.code === 'NOT_FOUND');
    await review('REJECT', { reason: 'Please visit the school office' }); assert.equal(linkedTo, null); assert.equal(entry.reason, 'Please visit the school office');

    // Admin authorization requires an active server-side admin record.
    replace(prisma.admin, 'findFirst', async ({ where }: any) => { assert.equal(where.status, 'active'); return where.id === 'admin-a' ? { id: 'admin-a', schoolId: 'school-a' } : null; });
    assert.equal(await getParentAccessAdmin(async () => null), null);
    assert.equal(await getParentAccessAdmin(async () => ({ id: 'teacher-a' })), null);
    assert.equal((await getParentAccessAdmin(async () => ({ id: 'admin-a' })))?.schoolId, 'school-a');

    // Even an active parent cannot ask for another child’s targeted announcements.
    parentStatus = 'ACTIVE';
    replace(prisma.student, 'findFirst', async () => null);
    assert.equal((await announcements(req('announcements?studentId=other-child&classId=2'))).status, 403);

    // Waiting parents can correct their own profile, never another parent's or an active profile.
    let correctedWhere: any;
    parentStatus = 'PENDING';
    replace(prisma.parent, 'findFirst', async (args: any) => args.where.id?.not ? null : { accessStatus: parentStatus });
    replace(prisma.parent, 'updateMany', async (args: any) => { correctedWhere = args.where; return { count: args.where.accessStatus.in.includes(parentStatus) ? 1 : 0 }; });
    const correction = { action: 'UPDATE_PROFILE', name: 'Correct', surname: 'Parent', phone: '20123456', id: 'someone-else' };
    assert.equal((await updateAccessProfile(req('parent/access', 'PATCH', correction))).status, 200);
    assert.equal(correctedWhere.id, 'parent-a'); assert.equal(correctedWhere.schoolId, 'school-a');
    parentStatus = 'ACTIVE';
    assert.equal((await updateAccessProfile(req('parent/access', 'PATCH', correction))).status, 403);
    parentStatus = 'REJECTED';
    replace(prisma.notification, 'findMany', async ({ where }: any) => { assert.equal(where.type, 'PARENT_ACCESS'); return []; });
    assert.equal((await notificationInbox(req('notifications'))).status, 200, 'A rejected account sees account messages only');

    // Shared, persistent rate limit continues across callers.
    let count = 0;
    replace(prisma.mobileRateLimit, 'upsert', async () => ({ count: ++count }));
    assert.equal((await checkPersistentRateLimit('test', 'lookup', 2)).success, true);
    assert.equal((await checkPersistentRateLimit('test', 'lookup', 2)).success, true);
    assert.equal((await checkPersistentRateLimit('test', 'lookup', 2)).success, false);

    // Durable outbox: do not discard when no device; send to a registered device only once.
    let device: string | null = null; let outboxStatus = 'PENDING'; let sentBody: any;
    replace(prisma.parentAccessDelivery, 'findMany', async () => outboxStatus === 'PENDING' ? [{ id: 'delivery-a', parentId: 'parent-a', title: 'Activated', message: 'Open app', eventType: 'PARENT_ACCESS', notificationId: 1, parent: { expoPushToken: device } }] : []);
    replace(prisma.parentAccessDelivery, 'updateMany', async () => ({ count: 1 }));
    replace(prisma.parentAccessDelivery, 'update', async ({ data }: any) => { outboxStatus = data.status; return {}; });
    const oldFetch = globalThis.fetch; restores.push(() => { globalThis.fetch = oldFetch; });
    globalThis.fetch = (async (_url: any, init: any) => { sentBody = JSON.parse(init.body); return { json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }) }; }) as any;
    await flushAccessNotifications('parent-a'); assert.equal(outboxStatus, 'PENDING'); assert.equal(Boolean(sentBody), false);
    device = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
    await flushAccessNotifications('parent-a'); assert.equal(outboxStatus, 'SENT'); assert.equal(sentBody[0].data.type, 'PARENT_ACCESS');
    console.log('Parent approval checks passed: signup stays pending, protected APIs deny access, masked status, school/admin/child ownership, request deduplication, atomic decision guards, audit, localized notification outbox and persistent limits.');
  } finally { restores.reverse().forEach(restore => restore()); if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
