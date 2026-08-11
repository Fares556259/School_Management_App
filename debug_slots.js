const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  // Check what schoolId the timetable slots have
  const allSlots = await prisma.timetableSlot.findMany({
    where: { isDraft: false },
    select: { id: true, day: true, classId: true, schoolId: true, teacherId: true, isDraft: true, startTime: true, subject: { select: { name: true } }, class: { select: { name: true } } },
    orderBy: { classId: 'asc' }
  });

  console.log('=== ALL PUBLISHED TIMETABLE SLOTS ===');
  const byClass = {};
  allSlots.forEach(s => {
    const key = `Class ${s.classId} (${s.class?.name}) - schoolId: ${s.schoolId}`;
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(`  Slot ${s.id}: ${s.day} ${s.startTime} - ${s.subject?.name || 'Free'} - teacher: ${s.teacherId || 'NONE'} - isDraft: ${s.isDraft}`);
  });
  
  Object.entries(byClass).forEach(([cls, slots]) => {
    console.log(`\n${cls}`);
    slots.forEach(s => console.log(s));
  });

  // Check what schoolId the admin session would resolve to
  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  console.log('\n=== SCHOOLS ===');
  schools.forEach(s => console.log(`  ${s.id}: ${s.name}`));

  // Also check draft slots  
  const draftSlots = await prisma.timetableSlot.findMany({
    where: { isDraft: true },
    select: { id: true, day: true, classId: true, schoolId: true, class: { select: { name: true } } }
  });
  console.log(`\n=== DRAFT SLOTS: ${draftSlots.length} total ===`);
  draftSlots.slice(0, 10).forEach(s => console.log(`  Slot ${s.id}: ${s.day} class=${s.classId}(${s.class?.name}) schoolId=${s.schoolId}`));
}

test().finally(() => prisma.$disconnect());
