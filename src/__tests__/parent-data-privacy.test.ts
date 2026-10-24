import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/mobileAuth';
import { GET } from '../app/api/mobile/parent-data/route';
async function main() {
  const oldFind = prisma.parent.findFirst, oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'parent-data-test-secret-32-characters-long';
  let unavailable = false;
  (prisma.parent as any).findFirst = async (args:any) => {
    assert.equal(args.where.id,'parent-a'); assert.equal(args.where.schoolId,'school-a');
    if (args.select) return {id:'parent-a', accessStatus:'ACTIVE'};
    if (unavailable) throw new Error('PRIVATE_DATABASE_DETAILS');
    const students = args.include.students;
    assert.deepEqual(students.where,{schoolId:'school-a'});
    assert.deepEqual(students.include.payments.where,{schoolId:'school-a'});
    assert.deepEqual(students.include.results.where,{schoolId:'school-a'});
    const timetable = students.include.class.include.timetable;
    assert.deepEqual(timetable.where,{schoolId:'school-a',isDraft:false});
    assert.deepEqual(timetable.include.teacher,{select:{id:true,name:true,surname:true,img:true}});
    return {students:[{id:'child-a'}]};
  };
  try {
    const request=()=>new NextRequest('https://example.com/api/mobile/parent-data?studentId=foreign',{headers:{Authorization:`Bearer ${generateToken({userId:'parent-a',userType:'parent',schoolId:'school-a'})}`}});
    const response=await GET(request()); assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.deepEqual(await response.json(),[{id:'child-a'}]);
    unavailable=true; const failed=await GET(request()); assert.equal(failed.status,500);
    assert(!(await failed.text()).includes('PRIVATE_DATABASE_DETAILS'));
    console.log('Parent data scopes children and records, excludes teacher credentials and draft timetables, and hides database error details.');
  } finally { prisma.parent.findFirst=oldFind; if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;await prisma.$disconnect(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
