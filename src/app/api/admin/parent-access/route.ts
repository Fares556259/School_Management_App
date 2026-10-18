import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getParentAccessAdmin } from '@/lib/parentAccessAdmin';
import { ParentAccessError, reviewAccessRequest } from '@/lib/parentAccess';
import { flushAccessNotifications } from '@/lib/parentAccessNotifications';
import { invalidateTenantTags } from '@/lib/cache';
import { waitUntil } from '@vercel/functions';
import { getParentAccessInboxData, isParentAccessStatus } from '@/lib/parentAccessInbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
async function authenticateAdmin() {
  try {
    const admin = await getParentAccessAdmin();
    return { admin, response: admin ? null : NextResponse.json({ code: 'ADMIN_SESSION_REQUIRED' }, { status: 401 }) };
  } catch (error) {
    console.error('[Parent access auth]', error);
    return { admin: null, response: NextResponse.json({ code: 'AUTH_UNAVAILABLE' }, { status: 503 }) };
  }
}
export async function GET(request: Request) {
  const { admin, response } = await authenticateAdmin();
  if (!admin) return response!;
  const url = new URL(request.url);
  if (url.searchParams.get('summary') === '1') return NextResponse.json({ pending: await prisma.parentAccessRequest.count({ where: { schoolId: admin.schoolId, status: 'PENDING' } }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  const status = url.searchParams.get('status') || 'PENDING';
  if (!isParentAccessStatus(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  const classId = Number(url.searchParams.get('classId')) || undefined;
  const search = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const page = Math.max(1, Math.min(10000, Math.floor(Number(url.searchParams.get('page')) || 1)));
  const data = await getParentAccessInboxData(admin.schoolId, {
    status,
    classId,
    search,
    page,
    includeMeta: url.searchParams.get('meta') !== '0',
  });
  if (url.searchParams.get('meta') !== '0') {
    const deliveryRetry = flushAccessNotifications().catch(error => console.error('[Activation retry]', error));
    try { waitUntil(deliveryRetry); } catch { void deliveryRetry; }
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  try {
    if (origin && new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ code: 'ORIGIN_FORBIDDEN' }, { status: 403 });
  } catch { return NextResponse.json({ code: 'ORIGIN_FORBIDDEN' }, { status: 403 }); }
  const { admin, response } = await authenticateAdmin();
  if (!admin) return response!;
  try {
    const body = await request.json();
    if (!['APPROVE', 'REJECT', 'REVOKE'].includes(body.action) || !Array.isArray(body.requestIds) ||
        !body.requestIds.length || body.requestIds.length > 25 || body.requestIds.some((v: unknown) => typeof v !== 'string')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (body.action === 'APPROVE' && body.identityConfirmed !== true) return NextResponse.json({ code: 'IDENTITY_CONFIRMATION_REQUIRED' }, { status: 400 });
    if (body.action !== 'APPROVE' && (typeof body.reason !== 'string' || !body.reason.trim())) return NextResponse.json({ code: 'REASON_REQUIRED' }, { status: 400 });
    const results: Array<{ requestId: string; success: boolean; code?: string; status?: string; parentId?: string }> = [];
    const ids = Array.from(new Set<string>(body.requestIds));
    const startedAt = Date.now();
    // Three transactions fit the server's pool. Return unfinished requests rather than time out a large selection.
    for (let offset = 0; offset < ids.length; offset += 3) {
      if (Date.now() - startedAt > 30_000) {
        results.push(...ids.slice(offset).map(requestId => ({ requestId, success: false, code: 'BATCH_RETRY' })));
        break;
      }
      const chunk = await Promise.all(ids.slice(offset, offset + 3).map(async requestId => {
        try {
          return { success: true, ...await reviewAccessRequest({ requestId, schoolId: admin.schoolId, adminId: admin.id, action: body.action, reason: body.reason, batch: ids.length > 1 }) };
        } catch (error) {
          if (!(error instanceof ParentAccessError)) console.error('[Parent access decision]', requestId, error);
          return { requestId, success: false, code: error instanceof ParentAccessError ? error.code : 'REVIEW_FAILED' };
        }
      }));
      results.push(...chunk);
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
