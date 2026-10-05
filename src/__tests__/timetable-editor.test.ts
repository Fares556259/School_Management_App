import assert from "node:assert/strict";
import { test } from "node:test";
import { Day, PrismaClient } from "@prisma/client";
import { displayScheduleTime, findTimetableConflicts, timesOverlap, timeToMinutes, validateTimetableTime } from "../lib/timetableConflicts";
import { saveTimetableBlock, removeTimetableBlock, relocateTimetableBlock, publishTimetableDraft, replaceTimetableWeek, TimetableEditError } from "../lib/timetableEditor";

const slot = (overrides: any = {}) => ({ id: 1, schoolId: "school-a", classId: 1, day: Day.MONDAY, slotNumber: 1, groupId: 1, startTime: "08:00", endTime: "09:00", duration: 60, subjectId: 1, teacherId: "teacher-a", roomId: 1, isDraft: false, ...overrides });
function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, condition]: [string, any]) => {
    if (key === "OR") return condition.some((w: any) => matches(row, w));
    if (key === "AND") return condition.every((w: any) => matches(row, w));
    if (condition && typeof condition === "object") {
      if (condition.in) return condition.in.includes(row[key]);
      if (condition.not !== undefined) return row[key] !== condition.not;
    }
    return row[key] === condition;
  });
}
function fixture(initial: any[] = []) {
  let rows = structuredClone(initial);
  let failNextCreate = false;
  let lockCount = 0;
  let nextId = 100;
  const entities = {
    class: [{ id: 1, name: "1A", schoolId: "school-a" }, { id: 2, name: "2A", schoolId: "school-a" }],
    subject: [{ id: 1, schoolId: "school-a" }, { id: 2, schoolId: "school-a" }],
    teacher: [{ id: "teacher-a", name: "Teacher", surname: "A", schoolId: "school-a" }, { id: "teacher-b", name: "Teacher", surname: "B", schoolId: "school-a" }],
    room: [{ id: 1, name: "Room A", schoolId: "school-a" }, { id: 2, name: "Room B", schoolId: "school-a" }],
  };
  const enrich = (row: any) => ({ ...row, class: entities.class.find(c => c.id === row.classId), teacher: entities.teacher.find(t => t.id === row.teacherId), room: entities.room.find(r => r.id === row.roomId) });
  const db = { $transaction: async (run: any) => {
    let work = structuredClone(rows);
    const tx: any = {
      $executeRaw: async (_parts: any, schoolKey: string) => { assert.equal(schoolKey, "timetable:school-a"); lockCount++; },
      institution: { findFirst: async ({ where }: any) => { assert.equal(where.schoolId, "school-a"); return { dayStartTime: "08:00", dayEndTime: "16:00" }; } },
      timetableSlot: {
        findFirst: async ({ where }: any) => work.find(row => matches(row, where)) || null,
        findMany: async ({ where }: any) => work.filter(row => matches(row, where)).map(enrich),
        deleteMany: async ({ where }: any) => { work = work.filter(row => !matches(row, where)); },
        update: async ({ where, data }: any) => { const row = work.find(row => matches(row, where)); if (!row) throw new Error("Missing row"); Object.assign(row, data); return enrich(row); },
        updateMany: async ({ where, data }: any) => work.filter(row => matches(row, where)).forEach(row => Object.assign(row, data)),
        create: async ({ data }: any) => { if (failNextCreate) { failNextCreate = false; throw new Error("Synthetic write failure"); } const row = { id: nextId++, ...data }; work.push(row); return enrich(row); },
        createMany: async ({ data }: any) => data.forEach((entry: any) => work.push({ id: nextId++, ...entry })),
      },
    };
    for (const [model, data] of Object.entries(entities)) tx[model] = {
      findFirst: async ({ where }: any) => data.find(row => matches(row, where)) || null,
      findMany: async ({ where }: any) => data.filter(row => matches(row, where)),
    };
    const result = await run(tx);
    rows = work;
    return result;
  } } as unknown as PrismaClient;
  return { db, rows: () => rows, locks: () => lockCount, failCreate: () => { failNextCreate = true; } };
}
const input = (overrides: any = {}) => ({ classId: 1, day: Day.MONDAY, startTime: "10:00", duration: 60, sessions: [{ subjectId: 1, teacherId: "teacher-a", roomId: 1 }], ...overrides });
const rejectsCode = (promise: Promise<any>, code: string) => assert.rejects(promise, error => error instanceof TimetableEditError && error.code === code);

test("24-hour parsing rejects invalid and AM/PM inputs; boundaries allow adjacent sessions", () => {
  assert.equal(timeToMinutes("13:15"), 795);
  for (const value of ["08:00 AM", "8:00", "24:00", "09:60", "bad"]) assert.ok(Number.isNaN(timeToMinutes(value)));
  assert.equal(timesOverlap("08:00", "09:00", "09:00", "10:00"), false);
  assert.equal(timesOverlap("08:30", "09:30", "09:00", "10:00"), true);
  assert.equal(validateTimetableTime("15:00", 60, "08:00", "16:00"), null);
  assert.equal(validateTimetableTime("15:30", 60, "08:00", "16:00"), "outsideSchoolHours");
  assert.equal(validateTimetableTime("07:30", 60, "08:00", "16:00"), "outsideSchoolHours");
});

test("conflicts use time rather than slot number", () => {
  const proposed = slot({ id: undefined, classId: 2, slotNumber: 7, startTime: "08:30", endTime: "09:30" });
  assert.deepEqual(findTimetableConflicts([proposed], [slot()]).map(c => c.kind), ["teacher", "room"]);
  assert.deepEqual(findTimetableConflicts([slot({ startTime: "09:00", endTime: "10:00" })], [slot()]), []);
});

test("parallel groups can share the class block but cannot share a teacher or room", () => {
  assert.equal(findTimetableConflicts([slot(), slot({ id: 2, teacherId: "teacher-b", roomId: 2 })], []).length, 0);
  assert.deepEqual(findTimetableConflicts([slot(), slot({ id: 2 })], []).map(c => c.kind), ["teacher", "room"]);
});

test("saving a gap leaves all other start times unchanged", async () => {
  const f = fixture([slot(), slot({ id: 2, slotNumber: 2, startTime: "13:00", endTime: "14:00" })]);
  const before = structuredClone(f.rows());
  const saved = await saveTimetableBlock(f.db, "school-a", input());
  assert.equal(saved[0].startTime, "10:00"); assert.equal(saved[0].endTime, "11:00");
  for (const old of before) assert.deepEqual(f.rows().find(s => s.id === old.id), old);
  assert.equal(f.locks(), 1);
});

test("class overlaps are blocked before writing", async () => {
  const f = fixture([slot()]);
  await rejectsCode(saveTimetableBlock(f.db, "school-a", input({ startTime: "08:30", sessions: [{ subjectId: 2, teacherId: "teacher-b", roomId: 2 }] })), "scheduleConflict");
  assert.equal(f.rows().length, 1);
});

test("teacher and room collisions across classes are blocked", async () => {
  for (const session of [{ subjectId: 1, teacherId: "teacher-a", roomId: 2 }, { subjectId: 1, teacherId: "teacher-b", roomId: 1 }]) {
    const f = fixture([slot({ classId: 2, slotNumber: 99 })]);
    await rejectsCode(saveTimetableBlock(f.db, "school-a", input({ startTime: "08:30", sessions: [session] })), "scheduleConflict");
    assert.equal(f.rows().length, 1);
  }
});

test("a duration update respects the chosen start time and leaves later slots unchanged", async () => {
  const f = fixture([slot(), slot({ id: 2, slotNumber: 2, startTime: "13:00", endTime: "14:00" })]);
  await saveTimetableBlock(f.db, "school-a", input({ id: 1, startTime: "09:30", duration: 90, sessions: [{ id: 1, subjectId: 1, teacherId: "teacher-a", roomId: 1 }] }));
  assert.equal(f.rows()[0].startTime, "09:30"); assert.equal(f.rows()[0].endTime, "11:00");
  assert.equal(f.rows()[1].startTime, "13:00");
});

test("saving two groups is atomic when the second write fails", async () => {
  const f = fixture([slot()]); f.failCreate();
  const before = structuredClone(f.rows());
  await assert.rejects(saveTimetableBlock(f.db, "school-a", input({ id: 1, sessions: [{ id: 1, subjectId: 1, teacherId: "teacher-a", roomId: 1 }, { subjectId: 2, teacherId: "teacher-b", roomId: 2 }] })), /Synthetic write failure/);
  assert.deepEqual(f.rows(), before);
});

test("editing a parallel block updates every group's interval together", async () => {
  const f = fixture([slot(), slot({ id: 2, groupId: 2, teacherId: "teacher-b", roomId: 2 })]);
  await saveTimetableBlock(f.db, "school-a", input({ id: 1, duration: 90, sessions: [{ id: 1, subjectId: 1, teacherId: "teacher-a", roomId: 1 }, { id: 2, subjectId: 2, teacherId: "teacher-b", roomId: 2 }] }));
  assert.deepEqual(f.rows().map(s => [s.startTime, s.endTime]), [["10:00", "11:30"], ["10:00", "11:30"]]);
  assert.deepEqual(f.rows().map(s => s.groupId), [1, 2]);
});

test("deleted groups are removed only after a complete valid replacement", async () => {
  const f = fixture([slot(), slot({ id: 2, groupId: 2, teacherId: "teacher-b", roomId: 2 })]);
  await saveTimetableBlock(f.db, "school-a", input({ id: 1, sessions: [{ id: 2, subjectId: 2, teacherId: "teacher-b", roomId: 2 }] }));
  assert.deepEqual(f.rows().map(s => s.id), [2]);
});

test("delete removes all groups and preserves following session times", async () => {
  const f = fixture([slot(), slot({ id: 2, groupId: 2 }), slot({ id: 3, slotNumber: 2, startTime: "12:00", endTime: "13:00" })]);
  await removeTimetableBlock(f.db, "school-a", 1);
  assert.deepEqual(f.rows().map(s => [s.id, s.startTime]), [[3, "12:00"]]);
});

test("foreign-school classes, rows and resources cannot be mutated", async () => {
  const foreign = slot({ schoolId: "school-b" });
  const f = fixture([foreign]);
  await rejectsCode(removeTimetableBlock(f.db, "school-a", 1), "sessionNotFound");
  await rejectsCode(relocateTimetableBlock(f.db, "school-a", 1, Day.TUESDAY, 1, "10:00"), "sessionNotFound");
  await rejectsCode(saveTimetableBlock(f.db, "school-a", input({ id: 1 })), "sessionNotFound");
  await rejectsCode(saveTimetableBlock(f.db, "school-a", input({ classId: 99 })), "sessionNotFound");
  await rejectsCode(saveTimetableBlock(f.db, "school-a", input({ sessions: [{ subjectId: 99 }] })), "invalidSession");
  await rejectsCode(saveTimetableBlock(f.db, "school-a", input({ sessions: [{ subjectId: 1, teacherId: "foreign" }] })), "invalidSession");
  assert.deepEqual(f.rows(), [foreign]);
});

test("moves to an empty slot preserve the exact destination and source-day gaps", async () => {
  const f = fixture([slot(), slot({ id: 2, slotNumber: 2, startTime: "12:00", endTime: "13:00" })]);
  await relocateTimetableBlock(f.db, "school-a", 1, Day.TUESDAY, 1, "10:30");
  assert.equal(f.rows()[0].day, Day.TUESDAY); assert.equal(f.rows()[0].startTime, "10:30");
  assert.equal(f.rows()[1].startTime, "12:00");
});

test("swaps with different durations validate the destination intervals", async () => {
  const f = fixture([slot(), slot({ id: 2, day: Day.TUESDAY, duration: 90, endTime: "09:30" })]);
  await relocateTimetableBlock(f.db, "school-a", 1, Day.TUESDAY, 1);
  assert.deepEqual(f.rows().map(s => [s.day, s.startTime, s.endTime]), [[Day.TUESDAY, "08:00", "09:00"], [Day.MONDAY, "08:00", "09:30"]]);
});

test("a failed move or swap leaves both source and destination unchanged", async () => {
  const f = fixture([slot(), slot({ id: 2, classId: 2, day: Day.TUESDAY })]);
  const before = structuredClone(f.rows());
  await rejectsCode(relocateTimetableBlock(f.db, "school-a", 1, Day.TUESDAY, 1, "08:30"), "scheduleConflict");
  assert.deepEqual(f.rows(), before);
});

test("drafts use their own class week and other classes' published availability", async () => {
  const f = fixture([slot()]);
  const saved = await saveTimetableBlock(f.db, "school-a", input({ isDraft: true, startTime: "08:00" }));
  assert.equal(saved[0].isDraft, true);
  const blocked = fixture([slot({ classId: 2 })]);
  await rejectsCode(saveTimetableBlock(blocked.db, "school-a", input({ isDraft: true, startTime: "08:00" })), "scheduleConflict");
});

test("publishing checks conflicts again and does not delete the live week on failure", async () => {
  const f = fixture([slot(), slot({ id: 2, isDraft: true, startTime: "10:00", endTime: "11:00" }), slot({ id: 3, classId: 2, startTime: "10:00", endTime: "11:00" })]);
  const before = structuredClone(f.rows());
  await rejectsCode(publishTimetableDraft(f.db, "school-a", 1), "scheduleConflict");
  assert.deepEqual(f.rows(), before);
});

test("publishing preserves duration, parallel groups and explicit times", async () => {
  const f = fixture([slot(), slot({ id: 2, isDraft: true, duration: 90, startTime: "10:15", endTime: "11:45" }), slot({ id: 3, isDraft: true, groupId: 2, duration: 90, startTime: "10:15", endTime: "11:45", teacherId: "teacher-b", roomId: 2 })]);
  await publishTimetableDraft(f.db, "school-a", 1);
  assert.deepEqual(f.rows().map(s => [s.duration, s.startTime, s.endTime, s.groupId, s.isDraft]), [[90, "10:15", "11:45", 1, false], [90, "10:15", "11:45", 2, false]]);
});

test("empty drafts cannot erase the published week", async () => {
  const f = fixture([slot()]);
  await rejectsCode(publishTimetableDraft(f.db, "school-a", 1), "sessionNotFound");
  assert.equal(f.rows().length, 1);
});

test("generated weeks validate before replacing live sessions", async () => {
  const f = fixture([slot(), slot({ id: 2, classId: 2, slotNumber: 8 })]);
  const before = structuredClone(f.rows());
  await rejectsCode(replaceTimetableWeek(f.db, "school-a", 1, [{ day: "MONDAY", slotNumber: 1, duration: 60, subjectId: 1, teacherId: "teacher-a" }]), "scheduleConflict");
  assert.deepEqual(f.rows(), before);
});
test("generated weeks preserve explicit 24-hour times and groups", async () => {
  const f = fixture([slot()]);
  await replaceTimetableWeek(f.db, "school-a", 1, [
    { day: "TUESDAY", slotNumber: 1, startTime: "13:00", duration: 60, subjectId: 1, teacherId: "teacher-a" },
    { day: "TUESDAY", slotNumber: 1, startTime: "13:00", duration: 60, subjectId: 2, teacherId: "teacher-b" },
  ]);
  assert.deepEqual(f.rows().map(s => [s.startTime, s.endTime, s.groupId]), [["13:00", "14:00", 1], ["13:00", "14:00", 2]]);
});
test("invalid generated resources cannot erase a live week", async () => {
  const f = fixture([slot()]);
  const before = structuredClone(f.rows());
  await rejectsCode(replaceTimetableWeek(f.db, "school-a", 1, [{ day: "MONDAY", slotNumber: 1, subjectId: 999 }]), "invalidSession");
  assert.deepEqual(f.rows(), before);
});

test("shared exam grid displays Date and ISO times in 24-hour form", () => {
  const date = new Date(2026, 9, 5, 13, 15);
  assert.equal(displayScheduleTime(date), "13:15");
  assert.equal(displayScheduleTime(date.toISOString()), "13:15");
  assert.equal(displayScheduleTime("08:30"), "08:30");
});
