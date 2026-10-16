import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { flushAccessNotifications } from '@/lib/parentAccessNotifications';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await flushAccessNotifications();
  await prisma.mobileRateLimit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 86400_000) } } });
  return NextResponse.json({ success: true });
}
