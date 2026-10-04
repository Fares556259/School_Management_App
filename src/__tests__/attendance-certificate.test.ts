import assert from 'node:assert/strict';
import { normalizeCertificateDraft,certificateReference,certificateFingerprint,registerAttendanceCertificate } from '../lib/attendanceCertificateRegistry';

async function main() {
 const data=normalizeCertificateDraft({schoolName:'Demo School',studentName:'Demo Pupil',issueDate:'04 أكتوبر 2026',purpose:'Demo purpose',certificateNumber:'FORGED'});
 assert.equal(data.certificateNumber,undefined);
 assert.equal(certificateReference(2026,1),'PRES-2026-000001');
 assert.throws(()=>certificateReference(2026,0));
 assert.throws(()=>normalizeCertificateDraft({schoolName:'x',studentName:'x',issueDate:5}));
 assert.throws(()=>normalizeCertificateDraft({...data,purpose:'x'.repeat(501)}));
 assert.equal(certificateFingerprint('pupil',data),certificateFingerprint('pupil',normalizeCertificateDraft({...data,purpose:' Demo purpose '})));
 assert.notEqual(certificateFingerprint('pupil',data),certificateFingerprint('pupil',{...data,purpose:'Changed purpose'}));
 const entries:any[]=[];let locked=false;
 const tx:any={
  $queryRaw:async (_strings:any,...args:any[])=>{assert.equal(args[0],'attendance-certificate:school-a');locked=true;},
  auditLog:{
   findFirst:async ({where}:any)=>{
    assert.ok(locked);assert.equal(where.schoolId,'school-a');
    return [...entries].reverse().find(e=>e.schoolId===where.schoolId && (where.entityId===undefined || e.entityId===where.entityId) && e.newValues[where.newValues.path[0]]===where.newValues.equals)??null;
   },
   create:async ({data}:any)=>{assert.ok(locked);entries.push(data);return data;}
  }
 };
 const input={schoolId:'school-a',studentId:'pupil',adminId:'admin',draft:data,now:new Date('2026-10-04T08:00:00Z')};
 assert.deepEqual(await registerAttendanceCertificate(tx,input),{reference:'PRES-2026-000001',reused:false});
 assert.deepEqual(await registerAttendanceCertificate(tx,input),{reference:'PRES-2026-000001',reused:true});
 assert.equal(entries.length,1);
 assert.equal((await registerAttendanceCertificate(tx,{...input,draft:{...data,purpose:'Changed'}})).reference,'PRES-2026-000002');
 assert.equal((await registerAttendanceCertificate(tx,{...input,studentId:'another-pupil'})).reference,'PRES-2026-000003');
 assert.equal((await registerAttendanceCertificate(tx,{...input,now:new Date('2026-12-31T23:30:00Z')})).reference,'PRES-2026-000001');
 assert.equal((await registerAttendanceCertificate(tx,{...input,draft:{...data,issueDate:'01 جانفي 2027'},now:new Date('2026-12-31T23:30:00Z')})).reference,'PRES-2027-000001');
 console.log('Certificate checks passed: normalization, reprints, revisions, year rollover, sequence and school lock.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
