import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateMobileRequest } from '@/lib/mobileAuth';
import { schoolDate, schoolDayRange, schoolMonth } from '@/lib/agent/dataAccuracy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;
  if (userType !== 'admin') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  try {
    const date = schoolDate();
    const range = schoolDayRange(date);
    const { month, year } = schoolMonth();
    const [rows, admin] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT
          (SELECT COUNT(*) FROM "ParentAccessRequest" WHERE "schoolId" = ${schoolId} AND status = 'PENDING')::int AS "parentRequests",
          (SELECT COUNT(DISTINCT "studentId") FROM "Attendance" WHERE "schoolId" = ${schoolId} AND status = 'ABSENT' AND date >= ${range.gte} AND date < ${range.lt})::int AS "absentStudents",
          (SELECT COALESCE(SUM(amount), 0) FROM "Income" WHERE "schoolId" = ${schoolId} AND date >= ${range.gte} AND date < ${range.lt})::float AS "todayRevenue",
          (SELECT COUNT(*) FROM "Student" s JOIN "Level" l ON l.id = s."levelId" AND l."schoolId" = ${schoolId}
            LEFT JOIN LATERAL (SELECT p.* FROM "Payment" p WHERE p."schoolId" = ${schoolId} AND p."studentId" = s.id AND LOWER(p."userType") = 'student' AND p.month = ${month} AND p.year = ${year} ORDER BY p.id LIMIT 1) pay ON true
            WHERE s."schoolId" = ${schoolId} AND
              CASE WHEN pay.status = 'PAID' THEN 0
                WHEN pay.status = 'PARTIAL' THEN COALESCE(pay."deferredAmount", GREATEST(0, COALESCE(s."customTuition", l."tuitionFee", 450) - pay.amount))
                ELSE COALESCE(pay."deferredAmount", pay.amount, s."customTuition", l."tuitionFee", 450) END > 0)::int AS "unpaidStudents"
      `,
      prisma.admin.findFirst({ where: { id: userId, schoolId }, select: { name: true, username: true } }),
    ]);
    const row = rows[0];
    return NextResponse.json({ success: true, adminName: admin?.name || admin?.username, date, month, year, fetchedAt: new Date().toISOString(), metrics: { parentRequests: Number(row.parentRequests), absentStudents: Number(row.absentStudents), todayRevenue: Number(row.todayRevenue), unpaidStudents: Number(row.unpaidStudents) } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[Hnia briefing]', error);
    return NextResponse.json({ success: false, error: 'Briefing unavailable' }, { status: 503 });
  }
}
