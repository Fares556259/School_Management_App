const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.hvkqjfihjvnqvdmotdzo:p-%21P%40T.iq%407G%23%2BQ@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify&connection_limit=1&pool_timeout=60&connect_timeout=60"
    }
  }
});

function addMinutes(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + (m || 0) + minutes;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

async function main() {
  const data = {
    id: 602,
    classId: 111,
    day: 'SATURDAY',
    slotNumber: 3,
    startTime: '11:00',
    endTime: '13:00',
    duration: 120,
    subjectId: 99,
    teacherId: '4f196a73-433b-496e-8a24-495910a8fbe2',
    roomId: 12,
    isDraft: false
  };

  const updatePayload = {};
  if (data.subjectId !== undefined) updatePayload.subjectId = data.subjectId;
  if (data.teacherId !== undefined) updatePayload.teacherId = data.teacherId;
  if (data.roomId !== undefined) updatePayload.roomId = data.roomId;
  if (data.duration !== undefined) updatePayload.duration = data.duration;
  
  try {
    const existing = await prisma.timetableSlot.findUnique({ where: { id: data.id } });
    if (existing) {
      updatePayload.endTime = addMinutes(existing.startTime, data.duration);
      console.log("updatePayload:", updatePayload);
      const updated = await prisma.timetableSlot.update({ where: { id: data.id }, data: updatePayload });
      console.log("Successfully updated!", updated.id);
    } else {
      console.log("Slot not found");
    }
  } catch (err) {
    console.error("Prisma error:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
