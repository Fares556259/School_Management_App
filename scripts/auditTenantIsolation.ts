import prisma from "../src/lib/prisma";

type Check = { relation: string; mismatches: bigint | number };

async function main() {
  const checks = await prisma.$queryRaw<Check[]>`
    SELECT 'Student→Class' AS relation, COUNT(*)::bigint AS mismatches
      FROM "Student" child JOIN "Class" owner ON owner.id = child."classId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Student→Parent', COUNT(*)::bigint
      FROM "Student" child JOIN "Parent" owner ON owner.id = child."parentId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Student→Level', COUNT(*)::bigint
      FROM "Student" child JOIN "Level" owner ON owner.id = child."levelId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Class→Level', COUNT(*)::bigint
      FROM "Class" child JOIN "Level" owner ON owner.id = child."levelId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Class→Supervisor', COUNT(*)::bigint
      FROM "Class" child JOIN "Teacher" owner ON owner.id = child."supervisorId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Lesson→Class', COUNT(*)::bigint
      FROM "Lesson" child JOIN "Class" owner ON owner.id = child."classId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Lesson→Teacher', COUNT(*)::bigint
      FROM "Lesson" child JOIN "Teacher" owner ON owner.id = child."teacherId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Lesson→Subject', COUNT(*)::bigint
      FROM "Lesson" child JOIN "Subject" owner ON owner.id = child."subjectId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Payment→Student', COUNT(*)::bigint
      FROM "Payment" child JOIN "Student" owner ON owner.id = child."studentId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Payment→Teacher', COUNT(*)::bigint
      FROM "Payment" child JOIN "Teacher" owner ON owner.id = child."teacherId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Payment→Staff', COUNT(*)::bigint
      FROM "Payment" child JOIN "Staff" owner ON owner.id = child."staffId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Attendance→Student', COUNT(*)::bigint
      FROM "Attendance" child JOIN "Student" owner ON owner.id = child."studentId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Attendance→Lesson', COUNT(*)::bigint
      FROM "Attendance" child JOIN "Lesson" owner ON owner.id = child."lessonId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Assignment→Lesson', COUNT(*)::bigint
      FROM "Assignment" child JOIN "Lesson" owner ON owner.id = child."lessonId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Resource→Lesson', COUNT(*)::bigint
      FROM "Resource" child JOIN "Lesson" owner ON owner.id = child."lessonId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Exam→Lesson', COUNT(*)::bigint
      FROM "Exam" child JOIN "Lesson" owner ON owner.id = child."lessonId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Result→Student', COUNT(*)::bigint
      FROM "Result" child JOIN "Student" owner ON owner.id = child."studentId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Grade→Student', COUNT(*)::bigint
      FROM "Grade" child JOIN "Student" owner ON owner.id = child."studentId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Grade→Subject', COUNT(*)::bigint
      FROM "Grade" child JOIN "Subject" owner ON owner.id = child."subjectId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'Notice→Class', COUNT(*)::bigint
      FROM "Notice" child JOIN "Class" owner ON owner.id = child."classId"
      WHERE child."schoolId" <> owner."schoolId"
    UNION ALL SELECT 'TimetableSlot→Class', COUNT(*)::bigint
      FROM "TimetableSlot" child JOIN "Class" owner ON owner.id = child."classId"
      WHERE child."schoolId" <> owner."schoolId"
  `;

  const normalized = checks.map((check) => ({
    relation: check.relation,
    mismatches: Number(check.mismatches),
  }));
  const failures = normalized.filter((check) => check.mismatches > 0);
  console.table(normalized);
  if (failures.length) {
    const grouped = await prisma.$queryRaw<Array<{ relation: string; childSchool: string; ownerSchool: string; mismatches: bigint }>>`
      SELECT 'Student→Class' AS relation, child."schoolId" AS "childSchool", owner."schoolId" AS "ownerSchool", COUNT(*)::bigint AS mismatches
        FROM "Student" child JOIN "Class" owner ON owner.id = child."classId" WHERE child."schoolId" <> owner."schoolId" GROUP BY child."schoolId", owner."schoolId"
      UNION ALL SELECT 'Student→Level', child."schoolId", owner."schoolId", COUNT(*)::bigint
        FROM "Student" child JOIN "Level" owner ON owner.id = child."levelId" WHERE child."schoolId" <> owner."schoolId" GROUP BY child."schoolId", owner."schoolId"
      UNION ALL SELECT 'Lesson→Class', child."schoolId", owner."schoolId", COUNT(*)::bigint
        FROM "Lesson" child JOIN "Class" owner ON owner.id = child."classId" WHERE child."schoolId" <> owner."schoolId" GROUP BY child."schoolId", owner."schoolId"
      UNION ALL SELECT 'Lesson→Teacher', child."schoolId", owner."schoolId", COUNT(*)::bigint
        FROM "Lesson" child JOIN "Teacher" owner ON owner.id = child."teacherId" WHERE child."schoolId" <> owner."schoolId" GROUP BY child."schoolId", owner."schoolId"
      UNION ALL SELECT 'Lesson→Subject', child."schoolId", owner."schoolId", COUNT(*)::bigint
        FROM "Lesson" child JOIN "Subject" owner ON owner.id = child."subjectId" WHERE child."schoolId" <> owner."schoolId" GROUP BY child."schoolId", owner."schoolId"
      UNION ALL SELECT 'Payment→Teacher', child."schoolId", owner."schoolId", COUNT(*)::bigint
        FROM "Payment" child JOIN "Teacher" owner ON owner.id = child."teacherId" WHERE child."schoolId" <> owner."schoolId" GROUP BY child."schoolId", owner."schoolId"
      UNION ALL SELECT 'Attendance→Lesson', child."schoolId", owner."schoolId", COUNT(*)::bigint
        FROM "Attendance" child JOIN "Lesson" owner ON owner.id = child."lessonId" WHERE child."schoolId" <> owner."schoolId" GROUP BY child."schoolId", owner."schoolId"
      UNION ALL SELECT 'Exam→Lesson', child."schoolId", owner."schoolId", COUNT(*)::bigint
        FROM "Exam" child JOIN "Lesson" owner ON owner.id = child."lessonId" WHERE child."schoolId" <> owner."schoolId" GROUP BY child."schoolId", owner."schoolId"
    `;
    console.table(grouped.map((row) => ({ ...row, mismatches: Number(row.mismatches) })));
    throw new Error(`Cross-school relation mismatches found: ${JSON.stringify(failures)}`);
  }
  console.log(`Tenant integrity passed: ${normalized.length} ownership relations have zero cross-school records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
