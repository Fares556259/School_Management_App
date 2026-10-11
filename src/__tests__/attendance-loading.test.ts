import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextResponse } from 'next/server';
import { parseSchoolDay } from '../lib/schoolDay';
import { fetchAttendanceJson, selectAttendanceSession } from '../lib/attendanceRoster';

function load(file: string, modules: Record<string, any>) {
  const exports: any = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  }}).outputText;
  vm.runInNewContext(code, { exports, require: (name: string) => {
    if (!(name in modules)) throw new Error(`Unmocked import: ${name}`);
    return modules[name];
  }, console, Date, Set, Map, URL, setTimeout }, { filename: file });
  return exports;
}

async function main() {
  const sessions = [{ id: 'slot-1', realLessonId: 11 }, { id: 'slot-2', realLessonId: 12 }, { id: 'slot-3', realLessonId: null }];
  const roster = [{ id: 'child', attendance: [
    { id: 2, lessonId: 12, status: 'LATE', note: 'Second session' },
    { id: 1, lessonId: 11, status: 'ABSENT', note: 'First session' },
  ] }];
  assert.equal(selectAttendanceSession(roster, sessions, 'slot-1')[0].attendance[0].status, 'ABSENT');
  assert.equal(selectAttendanceSession(roster, sessions, 'slot-2')[0].attendance[0].status, 'LATE');
  assert.equal(selectAttendanceSession(roster, sessions, 'slot-3')[0].attendance[0].id, -1, 'An unresolved slot must not borrow another session record');
  assert.deepEqual(selectAttendanceSession(roster, sessions, 'missing'), []);
  const daily = [{ attendance: [{ id: 3, lessonId: null, status: 'ABSENT', note: null }] }];
  assert.equal(selectAttendanceSession(daily, sessions, 'slot-2')[0].attendance[0].status, 'ABSENT');

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{"error":"denied"}', { status: 403 });
    await assert.rejects(fetchAttendanceJson('/api/attendance', new AbortController().signal), /403/);
    globalThis.fetch = async (_url, options) => {
      const signal = options?.signal;
      if (signal?.aborted) throw new Error('cancelled');
      return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
    };
    const abort = new AbortController();
    const pending = fetchAttendanceJson('/api/attendance', abort.signal);
    abort.abort();
    await assert.rejects(pending, /cancelled/);
  } finally { globalThis.fetch = originalFetch; }

  let denied = false, empty = false, reads = 0, writes = 0;
  const prisma: any = {
    class: { findFirst: async (args: any) => { assert.equal(args.where.schoolId, 'school-a'); return denied ? null : { id: 1 }; } },
    timetableSlot: { findMany: async (args: any) => { reads++; assert.equal(args.where.schoolId, 'school-a'); return empty ? [] : [{ id: 1, subjectId: 2, teacherId: 'teacher', startTime: '08:00', endTime: '10:00', subject: { name: 'Math' } }]; }, findFirst: async () => null },
    lesson: { findMany: async (args: any) => { assert.equal(args.where.schoolId, 'school-a'); return []; }, create: async () => { writes++; throw new Error('GET attempted a write'); } },
    student: { findMany: async (args: any) => { assert.equal(args.where.schoolId, 'school-a'); return args.where.id ? [] : roster; } },
    attendance: { findMany: async (args: any) => { assert.equal(args.where.schoolId, 'school-a'); assert.equal(args.where.student.schoolId, 'school-a'); return []; } },
    notification: { findMany: async (args: any) => { assert.equal(args.where.schoolId, 'school-a'); assert.equal(args.where.student.classId, 1); return []; } },
  };
  const api = load('src/app/api/attendance/route.ts', {
    '@/lib/prisma': { __esModule: true, default: prisma }, 'next/server': { NextResponse },
    '@/lib/timeUtils': { parseTime: () => ({ hours: 8, minutes: 0 }) }, '@prisma/client': {},
    '@/lib/notifications': {}, '@/lib/school': { getSchoolId: async () => 'school-a' },
    '@/lib/schoolDay': { parseSchoolDay },
  });
  const get = (query: string) => api.GET(new Request(`http://localhost/api/attendance?${query}`));
  let response = await get('classId=1&date=2026-10-05&view=roster');
  assert.equal(response.status, 200);
  let data = await response.json();
  assert.equal(data.lessons[0].id, 'slot-1');
  assert.equal(data.lessons[0].realLessonId, null);
  assert.equal(data.students[0].attendance.length, 2, 'Roster retains all session records for local selection');
  assert.equal(writes, 0, 'GET never creates missing lessons');
  for (const query of ['classId=nope&date=2026-10-05', 'classId=1&date=2026-02-30']) assert.equal((await get(query)).status, 400);
  denied = true;
  assert.equal((await get('classId=1&date=2026-10-05')).status, 404);
  denied = false;
  const beforeSunday = reads;
  assert.deepEqual((await (await get('classId=1&date=2026-10-11')).json()).lessons, []);
  assert.equal(reads, beforeSunday, 'Sunday never enters a Prisma Day enum query');
  empty = true;
  assert.deepEqual((await (await get('classId=1&date=2026-10-05')).json()).lessons, []);
  response = await api.POST(new Request('http://localhost/api/attendance', { method: 'POST', body: JSON.stringify({ date: '2026-10-05', lessonId: 'slot-1', records: [{ studentId: 'other-school-child', status: 'ABSENT' }] }) }));
  assert.equal(response.status, 404, 'Reject another school student before any attendance or lesson writes');
  assert.equal(writes, 0);

  const fixtures: any[] = [];
  const page = load('src/app/(dashboard)/admin/attendance/page.tsx', {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    '@tanstack/react-query': { useQuery: () => fixtures.shift(), useQueryClient: () => ({}) },
    'next/image': { __esModule: true, default: () => null },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '@/lib/translations/LanguageContext': { useLanguage: () => ({ t: { attendancePage: { loadingRecords: 'Loading records...', loadError: 'Unable to load attendance', noClasses: 'No classes', retry: 'Retry' } } }) },
    '@/lib/avatar': {}, '@/lib/attendanceRoster': { fetchAttendanceJson, selectAttendanceSession },
  }).default;
  fixtures.push({ isPending: true }, { isPending: true });
  let markup = renderToStaticMarkup(React.createElement(page));
  assert.match(markup, /role="status"/);
  assert.doesNotMatch(markup, /No class today/);
  fixtures.push({ isPending: false, data: [{ id: 1, name: '1A' }] }, { isPending: false, isError: true });
  markup = renderToStaticMarkup(React.createElement(page));
  assert.match(markup, /Unable to load attendance/);
  assert.doesNotMatch(markup, /No class today/);
  fixtures.push({ isPending: false, data: [] }, { isPending: true });
  markup = renderToStaticMarkup(React.createElement(page));
  assert.match(markup, /No classes/);
  console.log('Attendance regression checks passed: pending/error UI, local session selection, cancellation, GET without writes, school scoping, valid dates and rejected cross-school saves.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
