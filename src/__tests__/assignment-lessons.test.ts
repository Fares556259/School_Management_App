import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextResponse } from 'next/server';
import { parseTime } from '../lib/timeUtils';

function load(file: string, modules: Record<string, any>) {
  const exports: any = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  vm.runInNewContext(code, { exports, require: (name: string) => {
    if (!(name in modules)) throw new Error(`Unmocked import: ${name}`);
    return modules[name];
  }, console: { ...console, error: () => {} }, Date, Set, Map, URL }, { filename: file });
  return exports;
}

async function main() {
  const slot = { id: 80, classId: 6, teacherId: 'teacher-a', subjectId: 4,
    class: { name: '6E' }, subject: { name: 'العربية | Arabe | Arabic' }, teacher: { name: 'Demo', surname: 'Teacher' },
    day: 'MONDAY', startTime: '14:00', endTime: '16:00' };
  const existing = { ...slot, id: 9, name: 'Arabe' };
  let lessons: any[] = [], denied = false, role = 'admin', writes = 0, notifications = 0;
  let committed = 0, failAssignment = false, staged = 0;
  const checkScope = (where: any) => {
    assert.equal(where.schoolId, 'school-a');
    for (const relation of ['class', 'subject', 'teacher']) assert.equal(where[relation]?.schoolId, 'school-a');
  };
  const tx: any = {
    lesson: {
      findFirst: async ({where}: any) => { checkScope(where); return denied ? null : (lessons[0] || null); },
      create: async ({data}: any) => { writes++; staged++; assert.equal(data.schoolId,'school-a'); assert.equal(data.classId,6); assert.equal(data.teacherId,'teacher-a'); assert.equal(data.startTime.getUTCHours(),14); return {id:20}; },
    },
    timetableSlot: { findFirst: async ({where}: any) => {
      checkScope(where); assert.equal(where.isDraft,false);
      return denied || (where.teacherId && where.teacherId !== slot.teacherId) ? null : slot;
    } },
    assignment: {
      create: async ({data}: any) => { writes++; staged++; if (failAssignment) throw new Error('synthetic failure'); return {id:30, ...data}; },
      findFirst: async ({where}: any) => { assert.equal(where.schoolId,'school-a'); return denied ? null : {id:30}; },
      update: async () => { writes++; staged++; return {id:30}; },
    },
  };
  const prisma: any = {
    class: { findFirst: async ({where}: any) => { assert.equal(where.schoolId,'school-a'); return denied ? null : {id:6}; } },
    lesson: { findMany: async ({where}: any) => { checkScope(where); assert.equal(where.classId,6); return lessons; } },
    timetableSlot: { findMany: async ({where}: any) => { checkScope(where); assert.equal(where.classId,6); assert.equal(where.isDraft,false); return [slot,{...slot,id:81}]; } },
    $transaction: async (run: any) => { staged=0; try { const result = await run(tx); committed+=staged; return result; } finally { staged=0; } },
  };
  const service = load('src/lib/assignmentLessons.ts', {
    '@/lib/prisma': {__esModule:true,default:prisma}, '@/lib/school': {getSchoolId:async ()=>'school-a'},
    '@/lib/role': {getRole:async()=>role}, '@/utils/supabase/server': {getAuthenticatedUser:async()=>({id:'teacher-a'})},
    '@/lib/timeUtils': {parseTime},
  });
  const access = await service.getAssignmentAccess();
  let options = await service.getAssignmentLessonOptions(access,6);
  assert.equal(options.length,1,'Deduplicate recurring timetable subjects per class and teacher');
  assert.equal(options[0].id,'slot-80','Timetable-only class is selectable without existing lessons');
  assert.equal(options[0].class.name,'6E');
  assert.equal(writes,0,'Opening options is read-only');
  lessons=[existing];
  options=await service.getAssignmentLessonOptions(access,6);
  assert.equal(options.length,1,'Reuse saved lessons instead of duplicating timetable subjects');
  assert.equal(options[0].id,9);
  denied=true;
  await assert.rejects(service.getAssignmentLessonOptions(access,6),/Class not found/);
  await assert.rejects(service.resolveAssignmentLesson(tx,access,9),/Lesson not found/);
  await assert.rejects(service.resolveAssignmentLesson(tx,access,'slot-80'),/Scheduled lesson not found/);
  assert.equal(writes,0,'Foreign school selections rejected before any write');
  denied=false;
  role='parent'; await assert.rejects(service.getAssignmentAccess(),/Not authorized/);
  role='teacher'; const teacherAccess=await service.getAssignmentAccess();
  assert.equal(teacherAccess.teacherId,'teacher-a');
  await assert.rejects(service.resolveAssignmentLesson(tx,{schoolId:'school-a',teacherId:'another-teacher'},'slot-80'),/Scheduled lesson not found/);
  for (const value of ['slot-0','slot-80junk',-1,'bad']) await assert.rejects(service.resolveAssignmentLesson(tx,access,value),/Invalid lesson/);
  role='admin'; lessons=[];
  const actions=load('src/lib/crudActions.ts',{
    '@/lib/school':{getSchoolId:async()=>'school-a'}, './subjectConstants':{}, './assignmentLessons':service, './studentProfile':{},
    '@/lib/prisma':{__esModule:true,default:prisma}, 'next/cache':{revalidatePath:()=>{}},
    '@/lib/cache':{invalidateTenantTags:()=>{}}, '@/lib/audit':{createAuditLog:async()=>{}},
    './notifications':{createAssignmentNotification:async()=>{notifications++;}}, '@prisma/client':{},
  });
  const payload={title:'Synthetic task',startDate:'2026-10-12',dueDate:'2026-10-13',lessonId:'slot-80'};
  assert.equal((await actions.createAssignment(payload)).success,true);
  assert.equal(committed,2,'Lesson and assignment committed in one transaction');
  assert.equal(notifications,1,'Existing notification path runs after successful save');
  failAssignment=true; const before=committed;
  assert.equal((await actions.createAssignment(payload)).success,false);
  assert.equal(committed,before,'Failed assignment rolls back newly resolved lesson');
  assert.equal(notifications,1);
  failAssignment=false; denied=true; const beforeWrites=writes;
  assert.equal((await actions.updateAssignment(99,{lessonId:'slot-80'})).success,false);
  assert.equal(writes,beforeWrites,'Cross-school assignment update rejected before writes');
  denied=false;
  const api=load('src/app/api/assignment-lessons/route.ts',{'next/server':{NextResponse},'@/lib/assignmentLessons':service});
  assert.equal((await api.GET(new Request('http://localhost/api/assignment-lessons?classId=invalid'))).status,400);
  role='parent'; assert.equal((await api.GET(new Request('http://localhost/api/assignment-lessons?classId=6'))).status,403);
  role='admin';
  const fixtures: any[]=[]; const queryKeys: any[]=[];
  const translations={assignmentsPage:{modal:{selectClass:'Select class',selectLesson:'Select lesson',selectLessonPlaceholder:'Choose lesson',loadingLessons:'Loading lessons',optionsLoadError:'Unable to load options',retryOptions:'Retry',noLessons:'No scheduled lessons'}}};
  const form=load('src/components/forms/AssignmentForm.tsx',{
    react:React,'react/jsx-runtime':require('react/jsx-runtime'),
    '@hookform/resolvers/zod':require('@hookform/resolvers/zod'),'react-hook-form':require('react-hook-form'),zod:require('zod'),
    '@tanstack/react-query':{useQuery:(args:any)=>{queryKeys.push(args.queryKey);return fixtures.shift();}},
    '../InputField':{__esModule:true,default:()=>null},'@/lib/crudActions':{},
    '@/lib/translations/LanguageContext':{useLanguage:()=>({t:translations,locale:'fr'})},
    '@/lib/imageCompression':{},'react-toastify':{toast:{}},'@/lib/attendanceRoster':{},
  }).default;
  const render=(result:any)=>{fixtures.push({data:[{id:6,name:'6E'}]},result);return renderToStaticMarkup(React.createElement(form,{type:'create',data:{classId:6}}));};
  let markup=render({isPending:true}); assert.match(markup,/Loading lessons/);
  assert.match(markup,/disabled/); assert.doesNotMatch(markup,/No scheduled lessons/);
  markup=render({isError:true});assert.match(markup,/Unable to load options/);assert.match(markup,/Retry/);
  markup=render({data:options});assert.match(markup,/6E/);assert.match(markup,/Arabe/);assert.match(markup,/value="9"/);
  options=await service.getAssignmentLessonOptions(access,6);markup=render({data:options});assert.match(markup,/value="slot-80"/);
  assert.equal(queryKeys[1][0],'assignmentLessonOptions');assert.equal(queryKeys[1][1],'6');
  console.log('Assignment lesson checks passed: timetable-only options, deduplication, class/teacher/school authorization, read-only GET, transactional saves and rollback, loading/error form states. No live database or notifications used.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
