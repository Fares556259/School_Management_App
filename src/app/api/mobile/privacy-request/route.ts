import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateMobileRequest, checkRateLimit } from '@/lib/mobileAuth';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;
  const limit = checkRateLimit(userId, 'privacy-request');
  if (!limit.success) return NextResponse.json({success:false,error:'Too many requests. Please retry later.'},{status:429});
  try {
    const body = await request.json();
    const kind = body.kind;
    if (!['ACCOUNT_DELETION', 'AI_REPORT'].includes(kind) || (kind === 'AI_REPORT' && userType !== 'admin')) {
      return NextResponse.json({success:false,error:'Invalid request type.'},{status:400});
    }
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length > 4000 || (kind === 'AI_REPORT' && !message)) return NextResponse.json({success:false,error:'Invalid message.'},{status:400});
    // Requests stay within the authenticated school; clients cannot choose a tenant/user.
    const account = userType === 'parent'
      ? await prisma.parent.findFirst({where:{id:userId,schoolId},select:{id:true}})
      : userType === 'teacher'
      ? await prisma.teacher.findFirst({where:{id:userId,schoolId},select:{id:true}})
      : await prisma.admin.findFirst({where:{id:userId,schoolId},select:{id:true}});
    if (!account) return NextResponse.json({success:false,error:'Account unavailable.'},{status:403});
    const entry = await prisma.auditLog.create({data:{
      schoolId, action:kind, entityType:'PrivacyRequest', entityId:userId,
      performedBy:userId, description:kind === 'ACCOUNT_DELETION' ? 'Account and associated personal data deletion requested.' : 'Hnia response reported for review.',
      newValues:{status:'OPEN',role:userType,message},
    }});
    return NextResponse.json({success:true,reference:entry.id});
  } catch {
    return NextResponse.json({success:false,error:'Could not submit your request. Please retry.'},{status:500});
  }
}
