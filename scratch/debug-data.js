
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  const amine = await prisma.student.findFirst({
    where: { name: 'Amine', surname: 'Selmi' },
    include: {
        attendance: {
            include: {
                lesson: {
                    include: { subject: true }
                }
            }
        },
        class: {
            include: {
                slots: true
            }
        }
    }
  });

  if (!amine) {
    console.log("Amine Selmi not found");
    return;
  }

  console.log("Student:", amine.name, amine.surname);
  console.log("Class:", amine.class.name);
  console.log("Timetable Slots count:", amine.class.slots.length);
  console.log("Total Attendance Records:", amine.attendance.length);

  // Group by date to see gaps
  const dates = amine.attendance.map(a => a.date.toISOString().split('T')[0]);
  console.log("Attendance Dates:", [...new Set(dates)]);
}

checkData();
