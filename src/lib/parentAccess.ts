import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { accessDecisionMessage } from './parentAccessNotifications';

export class ParentAccessError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
export const maskedStudentReference = (id?: string | null) => `••••${(id || '').slice(-4)}`;
export function normalizeParentPhone(phone: string) {
  const digits = phone.replace(/[\s()+.\-]/g, '');
  return digits.startsWith('216') && digits.length === 11 ? digits.slice(3) : digits;
}

export function parentPhoneCandidates(phone: string) {
  const clean = normalizeParentPhone(phone);
  return clean.length === 8 ? [clean, `216${clean}`, `+216${clean}`] : [clean];
}

export async function submitAccessRequest(tx: Prisma.TransactionClient, parentId: string, schoolId: string, studentId: string, relation: string) {
  const student = await tx.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true, parentId: true } });
  if (!student) throw new ParentAccessError('STUDENT_NOT_FOUND', 404);
  if (student.parentId === parentId) return { alreadyLinked: true };
  // Conflicting claims stay private and are resolved by the school, never transferred here.
  const existing = await tx.parentAccessRequest.findUnique({ where: { parentId_studentId: { parentId, studentId } } });
  if (existing?.status === 'PENDING') return { requestId: existing.id, pendingApproval: true };
  if (existing?.status === 'APPROVED') throw new ParentAccessError('CONTACT_SCHOOL');
  const data = { relation, status: 'PENDING', reason: null, reviewedAt: null, reviewedBy: null, createdAt: new Date() };
  const entry = await tx.parentAccessRequest.upsert({
    where: { parentId_studentId: { parentId, studentId } },
    create: { ...data, parentId, studentId, schoolId }, update: data,
  });
  return { requestId: entry.id, pendingApproval: true };
}

/** State transition, ownership change, audit and notification are one transaction. */
export async function reviewAccessRequest(input: {
  requestId: string; schoolId: string; adminId: string; action: 'APPROVE' | 'REJECT' | 'REVOKE'; reason?: string; batch?: boolean;
}) {
  return prisma.$transaction(async tx => {
    const entry = await tx.parentAccessRequest.findFirst({
      where: { id: input.requestId, schoolId: input.schoolId },
      include: { parent: true, student: true },
    });
    if (!entry || entry.parent.schoolId !== input.schoolId || entry.student.schoolId !== input.schoolId) throw new ParentAccessError('NOT_FOUND', 404);
    // Serialize decisions for one parent so a rejection cannot overwrite a concurrent activation.
    await tx.$queryRaw`SELECT "id" FROM "Parent" WHERE "id" = ${entry.parentId} AND "schoolId" = ${input.schoolId} FOR UPDATE`;
    if ((input.action === 'REVOKE' && entry.status !== 'APPROVED') ||
        (input.action !== 'REVOKE' && entry.status !== 'PENDING')) throw new ParentAccessError('ALREADY_REVIEWED');
    if (input.action !== 'APPROVE' && !input.reason?.trim()) throw new ParentAccessError('REASON_REQUIRED', 400);
    if (input.action === 'APPROVE' && input.batch) {
      const conflicts = await tx.parentAccessRequest.count({ where: {
        studentId: entry.studentId, schoolId: input.schoolId, status: 'PENDING', parentId: { not: entry.parentId },
      } });
      if (conflicts) throw new ParentAccessError('CONFLICT_REQUIRES_REVIEW');
    }
    const status = input.action === 'APPROVE' ? 'APPROVED' : input.action === 'REJECT' ? 'REJECTED' : 'REVOKED';
    const transition = await tx.parentAccessRequest.updateMany({
      where: { id: entry.id, schoolId: input.schoolId, status: entry.status },
      data: { status, reviewedBy: input.adminId, reviewedAt: new Date(), reason: input.reason?.trim().slice(0, 500) || null },
    });
    if (transition.count !== 1) throw new ParentAccessError('ALREADY_REVIEWED');
    if (input.action === 'APPROVE') {
      const linked = await tx.student.updateMany({
        where: { id: entry.studentId, schoolId: input.schoolId, OR: [{ parentId: null }, { parentId: entry.parentId }] },
        data: { parentId: entry.parentId },
      });
      if (linked.count !== 1) throw new ParentAccessError('CHILD_ALREADY_LINKED');
      await tx.parent.update({ where: { id: entry.parentId }, data: { accessStatus: 'ACTIVE' } });
    } else {
      if (input.action === 'REVOKE') await tx.student.updateMany({
        where: { id: entry.studentId, schoolId: input.schoolId, parentId: entry.parentId }, data: { parentId: null },
      });
      const [children, pending] = await Promise.all([
        tx.student.count({ where: { parentId: entry.parentId, schoolId: input.schoolId } }),
        tx.parentAccessRequest.count({ where: { parentId: entry.parentId, schoolId: input.schoolId, status: 'PENDING' } }),
      ]);
      if (!children) await tx.parent.update({ where: { id: entry.parentId }, data: { accessStatus: pending ? 'PENDING' : 'REJECTED' } });
    }
    await tx.auditLog.create({ data: {
      schoolId: input.schoolId, performedBy: input.adminId, action: `PARENT_ACCESS_${input.action}`,
      entityType: 'ParentAccessRequest', entityId: entry.id,
      description: `${input.action}: parent ${entry.parentId}, student ${entry.studentId}`,
      oldValues: { status: entry.status }, newValues: { status, reason: input.reason || null },
    } });
    const [title, message] = accessDecisionMessage(entry.parent.preferredLocale, input.action, maskedStudentReference(entry.student.nationalId));
    const notification = await tx.notification.create({ data: {
      parentId: entry.parentId, schoolId: input.schoolId, type: 'PARENT_ACCESS', title, message,
    } });
    await tx.parentAccessDelivery.updateMany({
      where: { requestId: entry.id, status: 'PENDING' }, data: { status: 'SUPERSEDED' },
    });
    await tx.parentAccessDelivery.create({ data: {
      requestId: entry.id,
      parentId: entry.parentId, schoolId: input.schoolId, notificationId: notification.id,
      title, message, eventType: 'PARENT_ACCESS',
    } });
    return { requestId: entry.id, status, parentId: entry.parentId };
  }, { maxWait: 10_000, timeout: 20_000 });
}
