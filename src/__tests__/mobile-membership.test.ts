import assert from 'node:assert/strict';
import prisma from '../lib/prisma';
import { generateToken, authenticateMobileRequest } from '../lib/mobileAuth';
async function main() {
 const oldSecret=process.env.JWT_SECRET;process.env.JWT_SECRET='membership-test-only-secret-longer-than-32-characters';
 const originals=[prisma.admin.findFirst,prisma.teacher.findFirst,prisma.parent.findFirst] as const;
 let status='active',school='school-a',schoolStatus='ACTIVE',exists=true,unavailable=false;
 const lookup=async({where}:any)=>{
  if(unavailable)throw new Error('Synthetic DB outage');
  assert.equal(where.School.status,'ACTIVE');
  if(!exists||where.schoolId!==school||schoolStatus!=='ACTIVE'||(where.status&&where.status!==status))return null;
  return {id:'member',accessStatus:'ACTIVE'};
 };
 (prisma.admin as any).findFirst=lookup;(prisma.teacher as any).findFirst=lookup;(prisma.parent as any).findFirst=lookup;
 try {
  for(const role of ['admin','teacher','parent'] as const){
   const token=generateToken({userId:'member',userType:role,schoolId:'school-a'});
   const req=()=>new Request('https://example.com/api/mobile/private',{headers:{Authorization:`Bearer ${token}`}});
   assert.equal((await authenticateMobileRequest(req())).error,null);
   exists=false;assert.equal((await authenticateMobileRequest(req())).error?.status,401);exists=true;
   school='school-b';assert.equal((await authenticateMobileRequest(req())).error?.status,401);school='school-a';
   schoolStatus='SUSPENDED';assert.equal((await authenticateMobileRequest(req())).error?.status,401);schoolStatus='ACTIVE';
   unavailable=true;assert.equal((await authenticateMobileRequest(req())).error?.status,503);unavailable=false;
   if(role==='admin'){status='pending';assert.equal((await authenticateMobileRequest(req())).error?.status,401);status='active';}
  }
  console.log('Membership: existing JWT denied after deletion, transfer, school suspension or admin deactivation; database failure denies access.');
 } finally {
  [prisma.admin.findFirst,prisma.teacher.findFirst,prisma.parent.findFirst]=originals;
  if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
