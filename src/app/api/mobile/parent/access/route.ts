import { waitUntil } from '@vercel/functions';
import { flushAccessNotifications } from '@/lib/parentAccessNotifications';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateMobileRequest } from '@/lib/mobileAuth';
import { checkPersistentRateLimit } from '@/lib/mobileRateLimit';
import { maskedStudentReference, normalizeParentPhone, parentPhoneCandidates } from '@/lib/parentAccess';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const auth = await authenticateMobileRequest(request, { allowPendingParent: true });
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;
  if (userType !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parent = await prisma.parent.findFirst({
    where: { id: userId, schoolId },
    select: { accessStatus: true, name: true, surname: true, address: true, phone: true, School: { select: { name: true } },
      accessRequests: { where: { schoolId }, orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, reason: true, relation: true, createdAt: true, reviewedAt: true,
          student: { select: { nationalId: true } } } },
    },
  });
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const delivery = flushAccessNotifications(userId).catch(error => console.error('[Activation retry]', error));
  try { waitUntil(delivery); } catch { await delivery; }
  return NextResponse.json({
    accessStatus: parent.accessStatus, name: parent.name, surname: parent.surname, address: parent.address, phone: parent.phone, schoolName: parent.School.name,
    requests: parent.accessRequests.map(({ student, ...item }) => ({ ...item, reference: maskedStudentReference(student.nationalId) })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function PATCH(request: Request) {
  const auth = await authenticateMobileRequest(request, { allowPendingParent: true });
  if (auth.error) return auth.error;
  if (auth.payload.userType !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json();
  if (body.action === 'UPDATE_PROFILE') {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const surname = typeof body.surname === 'string' ? body.surname.trim().slice(0, 80) : '';
    const phone = typeof body.phone === 'string' ? normalizeParentPhone(body.phone) : '';
    if (!name || !surname || !/^[0-9]{8,15}$/.test(phone)) return NextResponse.json({ code: 'INVALID_PROFILE' }, { status: 400 });
    const rate = await checkPersistentRateLimit(auth.payload.userId, 'parent-profile-correction', 5, 3600_000);
    if (!rate.success) return NextResponse.json({ code: 'RATE_LIMITED' }, { status: 429 });
    const duplicate = await prisma.parent.findFirst({ where: { id: { not: auth.payload.userId }, OR: parentPhoneCandidates(phone).flatMap(value => [{ phone: value }, { username: value }]) }, select: { id: true } });
    if (duplicate) return NextResponse.json({ code: 'PHONE_TAKEN' }, { status: 409 });
    try {
      const updated = await prisma.parent.updateMany({
        where: { id: auth.payload.userId, schoolId: auth.payload.schoolId, accessStatus: { in: ['PENDING', 'REJECTED'] } },
        data: { name, surname, phone, username: phone, address: typeof body.address === 'string' ? body.address.trim().slice(0, 200) || 'Non renseignée' : 'Non renseignée' },
      });
      return NextResponse.json({ success: updated.count === 1 }, { status: updated.count ? 200 : 403 });
    } catch { return NextResponse.json({ code: 'PROFILE_UPDATE_FAILED' }, { status: 409 }); }
  }
  if (body.action !== 'CANCEL' || typeof body.requestId !== 'string') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const result = await prisma.parentAccessRequest.updateMany({
    where: { id: body.requestId, parentId: auth.payload.userId, schoolId: auth.payload.schoolId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  return NextResponse.json({ success: result.count === 1 });
}
