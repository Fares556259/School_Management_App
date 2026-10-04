import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/mobileAuth';
import { POST } from '../app/api/mobile/privacy-request/route';

async function main() {
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-privacy-secret-at-least-32-characters';
  const originalFind = prisma.parent.findFirst;
  const originalCreate = prisma.auditLog.create;
  let created: any;
  let exists = true;
  (prisma.parent as any).findFirst = async (args: any) => {
    assert.deepEqual(args.where, { id: 'privacy-test', schoolId: 'school-a' });
    return exists ? { id: 'privacy-test' } : null;
  };
  (prisma.auditLog as any).create = async (args: any) => { created = args.data; return { id: 42 }; };
  const token = generateToken({userId:'privacy-test',userType:'parent',schoolId:'school-a'});
  const request = (body: any, authenticated=true) => new NextRequest('https://example.com/api/mobile/privacy-request', {
    method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)
  });
  try {
    assert.equal((await POST(request({kind:'ACCOUNT_DELETION'},false))).status,401);
    assert.equal((await POST(request({kind:'AI_REPORT',message:'response'}))).status,400);
    assert.equal((await POST(request({kind:'UNKNOWN'}))).status,400);
    const response=await POST(request({kind:'ACCOUNT_DELETION',schoolId:'school-b',userId:'other'}));
    assert.equal(response.status,200);assert.equal((await response.json()).reference,42);
    assert.equal(created.schoolId,'school-a');assert.equal(created.entityId,'privacy-test');
    exists=false;
    assert.equal((await POST(request({kind:'ACCOUNT_DELETION'}))).status,403);
    console.log('Privacy request checks passed: authentication, role, input, tenant isolation and account existence.');
  } finally {
    (prisma.parent as any).findFirst=originalFind;
    (prisma.auditLog as any).create=originalCreate;
    if(secret===undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET=secret;
    await prisma.$disconnect();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
