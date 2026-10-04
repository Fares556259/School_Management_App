import { NextRequest,NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { getSchoolId } from '@/lib/school';
import { normalizeCertificateDraft,registerAttendanceCertificate } from '@/lib/attendanceCertificateRegistry';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest) {
  const origin=request.headers.get('origin');
  if (origin && origin!==request.nextUrl.origin) return NextResponse.json({error:'Invalid request origin.'},{status:403});
  const user=await getAuthenticatedUser();
  if (!user) return NextResponse.json({error:'Authentication required.'},{status:401});
  try {
    const schoolId=await getSchoolId();
    const admin=await prisma.admin.findFirst({where:{id:user.id,schoolId,status:'active'},select:{id:true}});
    if (!admin) return NextResponse.json({error:'Administrator access required.'},{status:403});
    const body=await request.json();
    if (typeof body.studentId!=='string' || body.studentId.length>200) return NextResponse.json({error:'Invalid student.'},{status:400});
    let draft:Record<string,string>;
    try {draft=normalizeCertificateDraft(body.data);} catch {return NextResponse.json({error:'Invalid certificate details.'},{status:400});}
    const result=await prisma.$transaction(async tx=>{
      const student=await tx.student.findFirst({where:{id:body.studentId,schoolId},select:{id:true}});
      if (!student) return null;
      return registerAttendanceCertificate(tx,{schoolId,studentId:student.id,adminId:user.id,draft});
    },{maxWait:10000,timeout:15000});
    if (!result) return NextResponse.json({error:'Student unavailable.'},{status:404});
    return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
  } catch {return NextResponse.json({error:'Could not register certificate. Please retry.'},{status:500});}
}
