import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
const fields=['delegation','schoolName','studentName','birthDate','birthPlace','className','purpose','issueCity','issueDate','directorName'] as const;
export function normalizeCertificateDraft(input:unknown):Record<string,string> {
  if (!input || typeof input!=='object' || Array.isArray(input)) throw new Error('Invalid certificate data.');
  const values=input as Record<string,unknown>, draft:Record<string,string>={};
  for (const field of fields) {
    if (values[field]!==undefined && typeof values[field]!=='string') throw new Error('Invalid certificate field.');
    const text=((values[field] as string|undefined)??'').trim();
    if (text.length>500) throw new Error('Certificate field is too long.');
    draft[field]=text;
  }
  if (!draft.studentName || !draft.schoolName || !draft.issueDate) throw new Error('Missing certificate details.');
  return draft;
}
export function certificateFingerprint(studentId:string,draft:Record<string,string>) {
  return createHash('sha256').update(JSON.stringify({studentId,...draft})).digest('hex');
}
export function certificateReference(year:number,sequence:number) {
  if (!Number.isSafeInteger(sequence) || sequence<1) throw new Error('Invalid certificate sequence.');
  return `PRES-${year}-${String(sequence).padStart(6,'0')}`;
}
export async function registerAttendanceCertificate(tx:Prisma.TransactionClient,input:{schoolId:string;studentId:string;adminId:string;draft:Record<string,string>;now?:Date}) {
  const now=input.now??new Date();
  const year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Africa/Tunis'}).format(now));
  const fingerprint=certificateFingerprint(input.studentId,input.draft);
  // Serialize allocation across app instances. Return boolean instead of PostgreSQL's void type.
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtext(${`attendance-certificate:${input.schoolId}`}), ${year}::integer)`;
  const where={schoolId:input.schoolId,entityType:'AttendanceCertificate',action:'CERTIFICATE_REGISTERED'};
  const existing=await tx.auditLog.findFirst({where:{...where,entityId:input.studentId,newValues:{path:['fingerprint'],equals:fingerprint}},select:{newValues:true}});
  const saved=existing?.newValues as Record<string,unknown>|undefined;
  if (typeof saved?.reference==='string') return {reference:saved.reference,reused:true};
  const last=await tx.auditLog.findFirst({where:{...where,newValues:{path:['year'],equals:year}},orderBy:{id:'desc'},select:{newValues:true}});
  const previous=last?.newValues as Record<string,unknown>|undefined;
  const sequence=(typeof previous?.sequence==='number'?previous.sequence:0)+1;
  const reference=certificateReference(year,sequence);
  await tx.auditLog.create({data:{schoolId:input.schoolId,performedBy:input.adminId,entityType:'AttendanceCertificate',entityId:input.studentId,action:'CERTIFICATE_REGISTERED',description:`Attendance certificate ${reference} registered for printing.`,newValues:{year,sequence,reference,fingerprint,draft:input.draft},timestamp:now}});
  return {reference,reused:false};
}
