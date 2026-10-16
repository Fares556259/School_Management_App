import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getParentAccessAdmin } from '@/lib/parentAccessAdmin';
import { ParentAccessError, reviewAccessRequest } from '@/lib/parentAccess';
import { flushAccessNotifications } from '@/lib/parentAccessNotifications';
import { invalidateTenantTags } from '@/lib/cache';
import { waitUntil } from '@vercel/functions';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const admin = await getParentAccessAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  // Hobby permits daily cron only. Dashboard activity also retries due delivery jobs.
  const pendingDelivery = flushAccessNotifications().catch(error => console.error('[Activation retry]', error));
  try { waitUntil(pendingDelivery); } catch { await pendingDelivery; }
  if (url.searchParams.get('summary') === '1') return NextResponse.json({ pending: await prisma.parentAccessRequest.count({ where: { schoolId: admin.schoolId, status: 'PENDING' } }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  const status = url.searchParams.get('status') || 'PENDING';
  if (!['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  const classId = Number(url.searchParams.get('classId')) || undefined;
  const search = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const page = Math.max(1, Math.min(10000, Math.floor(Number(url.searchParams.get('page')) || 1)));
  const where = { schoolId: admin.schoolId, status,
    ...(classId ? { student: { classId, schoolId: admin.schoolId } } : {}),
    ...(search ? { OR: [
      { parent: { name: { contains: search, mode: 'insensitive' as const } } },
      { parent: { surname: { contains: search, mode: 'insensitive' as const } } },
      { parent: { phone: { contains: search } } },
      { student: { name: { contains: search, mode: 'insensitive' as const } } },
      { student: { surname: { contains: search, mode: 'insensitive' as const } } },
      { student: { nationalId: { contains: search } } },
    ] } : {}),
  };
  const [requests, total, counts, classes] = await Promise.all([
    prisma.parentAccessRequest.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * 25, take: 25,
      include: { parent: { select: { id: true, name: true, surname: true, phone: true, address: true } },
        student: { select: { id: true, name: true, surname: true, nationalId: true, parentId: true, class: { select: { id: true, name: true } },
          accessRequests: { where: { schoolId: admin.schoolId, status: 'PENDING' }, select: { id: true, parentId: true } } } } },
    }),
    prisma.parentAccessRequest.count({ where }),
    prisma.parentAccessRequest.groupBy({ by: ['status'], where: { schoolId: admin.schoolId }, _count: true }),
    prisma.class.findMany({ where: { schoolId: admin.schoolId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const reviewerIds = Array.from(new Set(requests.map(r => r.reviewedBy).filter((id): id is string => Boolean(id))));
  const reviewers = await prisma.admin.findMany({ where: { id: { in: reviewerIds }, schoolId: admin.schoolId }, select: { id: true, name: true, surname: true } });
  return NextResponse.json({ total, page, classes, counts: Object.fromEntries(counts.map(g => [g.status, g._count])),
    requests: requests.map(({ student, ...r }) => ({ ...r,
      reviewedByName: reviewers.find(a => a.id === r.reviewedBy)?.name || r.reviewedBy,
      student: { ...student, accessRequests: undefined },
      conflicting: Boolean((student.parentId && student.parentId !== r.parentId) || student.accessRequests.some(a => a.parentId !== r.parentId)),
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const admin = await getParentAccessAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    if (!['APPROVE', 'REJECT', 'REVOKE'].includes(body.action) || !Array.isArray(body.requestIds) ||
        !body.requestIds.length || body.requestIds.length > 25 || body.requestIds.some((v: unknown) => typeof v !== 'string')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (body.action === 'APPROVE' && body.identityConfirmed !== true) return NextResponse.json({ code: 'IDENTITY_CONFIRMATION_REQUIRED' }, { status: 400 });
    if (body.action !== 'APPROVE' && (typeof body.reason !== 'string' || !body.reason.trim())) return NextResponse.json({ code: 'REASON_REQUIRED' }, { status: 400 });
    const results = [];
    for (const requestId of Array.from(new Set<string>(body.requestIds))) {
      try {
        results.push({ success: true, ...await reviewAccessRequest({ requestId, schoolId: admin.schoolId, adminId: admin.id, action: body.action, reason: body.reason, batch: body.requestIds.length > 1 }) });
      } catch (error) {
        if (!(error instanceof ParentAccessError)) console.error('[Parent access decision]', requestId, error);
        results.push({ requestId, success: false, code: error instanceof ParentAccessError ? error.code : 'REVIEW_FAILED' });
      }
    }
    if (results.some(result => result.success)) invalidateTenantTags(admin.schoolId, 'parents', 'students', 'dashboard');
    // Decisions are committed first; transient push failures remain in the outbox.
    const dispatch = flushAccessNotifications().catch(error => console.error('[Activation push]', error));
    try { waitUntil(dispatch); } catch { await dispatch; }
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[Parent access review]', error);
    return NextResponse.json({ error: 'Unable to process requests' }, { status: 500 });
  }
}
