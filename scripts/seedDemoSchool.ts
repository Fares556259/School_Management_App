import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import {
  AttendanceStatus,
  Day,
  PaymentStatus,
  PrismaClient,
  UserSex,
} from "@prisma/client";

const prisma = new PrismaClient();

const SCHOOL_ID = "demo-ecole-tunisienne";
const SCHOOL_NAME = "École Démo Carthage — Données fictives";
const ADMIN_EMAIL = "demo.ecole@snapschool.academy";
const PARENT_PHONE = "29000001";
const CREDENTIALS_PATH =
  process.env.DEMO_CREDENTIALS_PATH || "/private/tmp/snapschool-demo-credentials.txt";

function generatedPassword() {
  return `${randomBytes(12).toString("base64url")}!7a`;
}

async function ensureAuthAdmin(password: string) {
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id::text FROM auth.users WHERE lower(email) = lower($1) LIMIT 1`,
    ADMIN_EMAIL,
  );

  let userId = existing[0]?.id;
  if (!userId) {
    const created = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `WITH new_user AS (
         INSERT INTO auth.users (
           instance_id, id, aud, role, email, encrypted_password,
           email_confirmed_at, raw_app_meta_data,
           raw_user_meta_data, created_at, updated_at,
           confirmation_token, recovery_token, email_change_token_new,
           email_change, phone_change, phone_change_token,
           email_change_token_current, reauthentication_token,
           is_sso_user, is_anonymous
         ) VALUES (
           '00000000-0000-0000-0000-000000000000'::uuid,
           gen_random_uuid(), 'authenticated', 'authenticated', $1,
           extensions.crypt($2, extensions.gen_salt('bf')), NOW(),
           jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
           jsonb_build_object('firstName','Inès','lastName','Gharbi','accountPurpose','demo'),
           NOW(), NOW(), '', '', '', '', '', '', '', '', false, false
         ) RETURNING id
       ), new_identity AS (
         INSERT INTO auth.identities (
           provider_id, user_id, identity_data, provider,
           last_sign_in_at, created_at, updated_at
         )
         SELECT $1, id,
           jsonb_build_object('sub', id::text, 'email', $1, 'email_verified', true, 'phone_verified', false),
           'email', NOW(), NOW(), NOW()
         FROM new_user
         RETURNING user_id
       ) SELECT user_id::text AS id FROM new_identity`,
      ADMIN_EMAIL,
      password,
    );
    userId = created[0]?.id;
    if (!userId) throw new Error("Demo auth user was not created.");
  }

  await prisma.$executeRawUnsafe(
    `UPDATE auth.users
       SET encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
           raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
             jsonb_build_object('role','admin','status','active','schoolId',$3,'demo',true),
           raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
             jsonb_build_object('firstName','Inès','lastName','Gharbi','accountPurpose','demo'),
           updated_at = NOW()
     WHERE id::text = $1`,
    userId,
    password,
    SCHOOL_ID,
  );

  return userId;
}

async function clearDemoSchool() {
  await prisma.$transaction(async (tx) => {
    await tx.parentAccessDelivery.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.parentAccessRequest.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.notification.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.result.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.attendance.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.grade.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.payment.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.notice.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.assignment.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.resource.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.exam.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.timetableSlot.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.gradeSheet.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.lesson.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.student.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.class.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.room.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.teacher.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.parent.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.staff.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.subject.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.level.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.expense.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.income.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.auditLog.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.examPeriodConfig.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.institution.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.admin.deleteMany({ where: { schoolId: SCHOOL_ID } });
  }, { timeout: 30_000 });
}

async function main() {
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD || generatedPassword();
  const parentPassword = process.env.DEMO_PARENT_PASSWORD || generatedPassword();
  const adminId = await ensureAuthAdmin(adminPassword);

  await prisma.school.upsert({
    where: { id: SCHOOL_ID },
    update: {
      name: SCHOOL_NAME,
      subdomain: "demo-carthage",
      status: "ACTIVE",
      plan: "PREMIUM",
      activatedAt: new Date(),
      updatedAt: new Date(),
    },
    create: {
      id: SCHOOL_ID,
      name: SCHOOL_NAME,
      subdomain: "demo-carthage",
      status: "ACTIVE",
      plan: "PREMIUM",
      activatedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await clearDemoSchool();

  await prisma.admin.create({
    data: {
      id: adminId,
      email: ADMIN_EMAIL,
      username: "demo_ecole_carthage",
      name: "Inès",
      surname: "Gharbi",
      phone: "71000001",
      schoolId: SCHOOL_ID,
      status: "active",
      aiQuota: 100,
    },
  });

  await prisma.institution.create({
    data: {
      schoolId: SCHOOL_ID,
      schoolName: SCHOOL_NAME,
      ministryName: "Ministère de l’Éducation — Démonstration",
      universityName: "Circonscription Tunis-Carthage — Démonstration",
      phone: "+216 71 000 001",
      address: "12 avenue de Carthage, Tunis — adresse fictive",
      academicYear: "2026-2027",
      currentSemester: 1,
      dayStartTime: "08:00",
      dayEndTime: "16:00",
      yearStart: new Date("2026-09-15T00:00:00.000Z"),
      yearEnd: new Date("2027-06-30T00:00:00.000Z"),
      sessions: [
        { id: 1, time: "08:00 - 10:00", label: "Séance 1" },
        { id: 2, time: "10:15 - 12:15", label: "Séance 2" },
        { id: 3, time: "13:30 - 15:30", label: "Séance 3" },
      ],
      holidays: [],
    },
  });

  const levels = [];
  for (let level = 1; level <= 6; level++) {
    levels.push(
      await prisma.level.create({
        data: { level, tuitionFee: 320 + level * 20, schoolId: SCHOOL_ID },
      }),
    );
  }

  const subjectSeed = [
    ["اللغة العربية", "مجال اللغة العربية"],
    ["Mathématiques", "Sciences et technologie"],
    ["Français", "Langues étrangères"],
    ["English", "Langues étrangères"],
    ["Éveil scientifique", "Sciences et technologie"],
    ["تربية إسلامية", "مجال التنشئة"],
    ["Histoire et géographie", "Sciences humaines"],
    ["Éducation physique", "Arts et sport"],
  ] as const;
  const subjects = [];
  for (const [name, domain] of subjectSeed) {
    subjects.push(await prisma.subject.create({ data: { name, domain, schoolId: SCHOOL_ID } }));
  }

  const teacherSeed = [
    ["Sonia", "Trabelsi", UserSex.FEMALE],
    ["Mehdi", "Ben Amor", UserSex.MALE],
    ["Rim", "Jlassi", UserSex.FEMALE],
    ["Walid", "Hammami", UserSex.MALE],
    ["Olfa", "Masmoudi", UserSex.FEMALE],
    ["Sami", "Khelifi", UserSex.MALE],
    ["Amel", "Dridi", UserSex.FEMALE],
    ["Nabil", "Ayari", UserSex.MALE],
  ] as const;
  const teachers = [];
  for (let index = 0; index < teacherSeed.length; index++) {
    const [name, surname, sex] = teacherSeed[index];
    teachers.push(
      await prisma.teacher.create({
        data: {
          id: `demo-teacher-${index + 1}`,
          code: `DEMO-P${String(index + 1).padStart(2, "0")}`,
          username: `demo.prof.${index + 1}`,
          name,
          surname,
          phone: `29110${String(index + 1).padStart(3, "0")}`,
          address: "Grand Tunis — donnée fictive",
          bloodType: ["A+", "O+", "B+"][index % 3],
          sex,
          birthday: new Date(1982 + index, index % 12, 10 + (index % 10)),
          salary: 1900 + index * 75,
          hourlyRate: 18 + index,
          activated: true,
          schoolId: SCHOOL_ID,
          subjects: { connect: [{ id: subjects[index].id }] },
        },
      }),
    );
  }

  const classNames = ["1A", "2A", "3A", "4A"];
  const classes = [];
  for (let index = 0; index < classNames.length; index++) {
    classes.push(
      await prisma.class.create({
        data: {
          name: classNames[index],
          capacity: 24,
          levelId: levels[index].id,
          supervisorId: teachers[index].id,
          schoolId: SCHOOL_ID,
        },
      }),
    );
  }

  const rooms = [];
  for (const name of ["Salle Jasmin", "Salle Olivier", "Salle Carthage", "Salle Didon"]) {
    rooms.push(await prisma.room.create({ data: { name, schoolId: SCHOOL_ID } }));
  }

  const families = [
    ["Amel", "Ben Salah", "Yasmine", "Aziz"],
    ["Mohamed", "Trabelsi", "Rayen", "Meriem"],
    ["Sarra", "Hammami", "Nour", "Youssef"],
    ["Karim", "Masmoudi", "Adam", "Eya"],
    ["Inès", "Jlassi", "Lina", "Omar"],
    ["Hichem", "Ayari", "Malek", "Farah"],
    ["Rania", "Dridi", "Ahmed", "Aya"],
    ["Sofiene", "Gharbi", "Islem", "Emna"],
    ["Leïla", "Khelifi", "Sami", "Maya"],
    ["Nader", "Abidi", "Anis", "Salma"],
    ["Olfa", "Mansour", "Wael", "Rim"],
    ["Bilel", "Cherif", "Amine", "Nesrine"],
  ] as const;
  const students = [];
  for (let index = 0; index < families.length; index++) {
    const [parentName, surname, firstChild, secondChild] = families[index];
    const parentId = `demo-parent-${index + 1}`;
    await prisma.parent.create({
      data: {
        id: parentId,
        username: index === 0 ? "demo.parent" : `demo.parent.${index + 1}`,
        name: parentName,
        surname,
        phone: index === 0 ? PARENT_PHONE : `29220${String(index + 1).padStart(3, "0")}`,
        address: "Grand Tunis — adresse fictive",
        password: index === 0 ? await bcrypt.hash(parentPassword, 12) : null,
        accessStatus: "ACTIVE",
        preferredLocale: "fr",
        schoolId: SCHOOL_ID,
      },
    });

    for (let childIndex = 0; childIndex < 2; childIndex++) {
      const ordinal = index * 2 + childIndex + 1;
      const targetClass = classes[(ordinal - 1) % classes.length];
      const name = childIndex === 0 ? firstChild : secondChild;
      students.push(
        await prisma.student.create({
          data: {
            id: `demo-student-${ordinal}`,
            username: `DEMO${String(ordinal).padStart(4, "0")}`,
            nationalId: `9900${String(ordinal).padStart(4, "0")}`,
            name,
            surname,
            address: "Grand Tunis — adresse fictive",
            bloodType: ["A+", "O+", "B+", "AB+"][ordinal % 4],
            sex: ordinal % 2 ? UserSex.FEMALE : UserSex.MALE,
            birthday: new Date(2016 + ((ordinal - 1) % 4), ordinal % 12, 4 + (ordinal % 20)),
            parentId,
            classId: targetClass.id,
            levelId: targetClass.levelId,
            schoolId: SCHOOL_ID,
          },
        }),
      );
    }
  }

  await prisma.staff.createMany({
    data: [
      { id: "demo-staff-1", username: "demo.staff.1", name: "Mouna", surname: "Saïdi", role: "Secrétaire", phone: "29330001", address: "Tunis — fictif", bloodType: "O+", salary: 1350, birthday: new Date("1988-02-12"), schoolId: SCHOOL_ID },
      { id: "demo-staff-2", username: "demo.staff.2", name: "Lotfi", surname: "Zidi", role: "Comptable", phone: "29330002", address: "Tunis — fictif", bloodType: "A+", salary: 1650, birthday: new Date("1984-08-21"), schoolId: SCHOOL_ID },
      { id: "demo-staff-3", username: "demo.staff.3", name: "Samira", surname: "Toumi", role: "Surveillante", phone: "29330003", address: "Tunis — fictif", bloodType: "B+", salary: 1450, birthday: new Date("1990-05-09"), schoolId: SCHOOL_ID },
    ],
  });

  const days = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY];
  const lessons = [];
  for (let classIndex = 0; classIndex < classes.length; classIndex++) {
    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      for (let slot = 1; slot <= 2; slot++) {
        const subjectIndex = (classIndex * 2 + dayIndex + slot - 1) % subjects.length;
        const lesson = await prisma.lesson.create({
          data: {
            name: `${subjects[subjectIndex].name} — ${classes[classIndex].name}`,
            day: days[dayIndex],
            startTime: new Date(slot === 1 ? "2026-10-19T08:00:00.000Z" : "2026-10-19T10:15:00.000Z"),
            endTime: new Date(slot === 1 ? "2026-10-19T10:00:00.000Z" : "2026-10-19T12:15:00.000Z"),
            subjectId: subjects[subjectIndex].id,
            classId: classes[classIndex].id,
            teacherId: teachers[subjectIndex].id,
            schoolId: SCHOOL_ID,
          },
        });
        lessons.push(lesson);
        await prisma.timetableSlot.create({
          data: {
            day: days[dayIndex],
            startTime: slot === 1 ? "08:00" : "10:15",
            endTime: slot === 1 ? "10:00" : "12:15",
            slotNumber: slot,
            duration: 120,
            subjectId: subjects[subjectIndex].id,
            teacherId: teachers[subjectIndex].id,
            classId: classes[classIndex].id,
            roomId: rooms[classIndex].id,
            schoolId: SCHOOL_ID,
          },
        });
      }
    }
  }

  for (const student of students) {
    for (let subjectIndex = 0; subjectIndex < subjects.length; subjectIndex++) {
      const base = 10 + ((student.id.length + subjectIndex * 3) % 9);
      await prisma.grade.createMany({
        data: [
          { studentId: student.id, subjectId: subjects[subjectIndex].id, term: 1, score: base, schoolId: SCHOOL_ID },
          { studentId: student.id, subjectId: subjects[subjectIndex].id, term: 2, score: Math.min(20, base + ((subjectIndex % 3) - 1)), schoolId: SCHOOL_ID },
        ],
      });
    }
  }

  for (let offset = 0; offset < 10; offset++) {
    const date = new Date(Date.UTC(2026, 9, 16 - offset, 8, 0, 0));
    if (date.getUTCDay() === 0) continue;
    for (let index = 0; index < students.length; index++) {
      const status = (index + offset) % 17 === 0
        ? AttendanceStatus.ABSENT
        : (index + offset) % 11 === 0
          ? AttendanceStatus.LATE
          : AttendanceStatus.PRESENT;
      await prisma.attendance.create({
        data: { date, status, studentId: students[index].id, schoolId: SCHOOL_ID },
      });
    }
  }

  for (let index = 0; index < students.length; index++) {
    for (const month of [9, 10]) {
      const status = month === 9 || index % 4 !== 0 ? PaymentStatus.PAID : PaymentStatus.PENDING;
      await prisma.payment.create({
        data: {
          amount: 320 + students[index].levelId * 20,
          month,
          year: 2026,
          status,
          userType: "STUDENT",
          studentId: students[index].id,
          paidAt: status === PaymentStatus.PAID ? new Date(Date.UTC(2026, month - 1, 6)) : null,
          schoolId: SCHOOL_ID,
        },
      });
    }
  }

  await prisma.notice.createMany({
    data: [
      { title: "Bienvenue dans l’espace de démonstration", message: "Toutes les personnes et informations présentées ici sont fictives.", important: true, schoolId: SCHOOL_ID },
      { title: "Réunion parents-enseignants", message: "Réunion de démonstration samedi à 10h00.", classId: classes[1].id, schoolId: SCHOOL_ID },
      { title: "Sortie pédagogique", message: "Visite fictive du musée de Carthage.", classId: classes[2].id, schoolId: SCHOOL_ID },
    ],
  });

  for (let index = 0; index < Math.min(8, lessons.length); index++) {
    await prisma.assignment.create({
      data: {
        title: `Exercice ${index + 1} — démonstration`,
        description: "Activité fictive destinée à présenter le suivi des devoirs.",
        startDate: new Date("2026-10-12T08:00:00.000Z"),
        dueDate: new Date(Date.UTC(2026, 9, 21 + index)),
        lessonId: lessons[index].id,
        schoolId: SCHOOL_ID,
      },
    });
    await prisma.resource.create({
      data: {
        title: `Support de cours ${index + 1}`,
        description: "Ressource fictive de démonstration",
        url: "https://www.snapschool.academy/privacy",
        lessonId: lessons[index].id,
        schoolId: SCHOOL_ID,
      },
    });
  }

  const exam = await prisma.exam.create({
    data: {
      title: "Évaluation de démonstration — Mathématiques",
      startTime: new Date("2026-10-22T08:00:00.000Z"),
      endTime: new Date("2026-10-22T09:00:00.000Z"),
      lessonId: lessons[0].id,
      examPeriod: 1,
      schoolId: SCHOOL_ID,
    },
  });
  await prisma.result.createMany({
    data: students.slice(0, 6).map((student, index) => ({
      score: 12 + index,
      examId: exam.id,
      studentId: student.id,
      schoolId: SCHOOL_ID,
    })),
  });

  await prisma.income.createMany({
    data: [
      { title: "Frais de scolarité — septembre", amount: 7680, category: "SCOLARITÉ", date: new Date("2026-09-10"), schoolId: SCHOOL_ID },
      { title: "Cantine — octobre", amount: 2160, category: "CANTINE", date: new Date("2026-10-05"), schoolId: SCHOOL_ID },
    ],
  });
  await prisma.expense.createMany({
    data: [
      { title: "Fournitures pédagogiques", amount: 840, category: "FOURNITURES", date: new Date("2026-09-18"), schoolId: SCHOOL_ID },
      { title: "Entretien des salles", amount: 560, category: "ENTRETIEN", date: new Date("2026-10-08"), schoolId: SCHOOL_ID },
      { title: "Facture STEG", amount: 430, category: "CHARGES", date: new Date("2026-10-12"), schoolId: SCHOOL_ID },
    ],
  });
  await prisma.auditLog.create({
    data: {
      action: "DEMO_SCHOOL_SEEDED",
      performedBy: adminId,
      entityType: "School",
      entityId: SCHOOL_ID,
      description: "Jeu de données fictives tunisiennes créé pour les démonstrations SnapSchool.",
      schoolId: SCHOOL_ID,
    },
  });

  await writeFile(
    CREDENTIALS_PATH,
    [
      `School: ${SCHOOL_NAME}`,
      `Dashboard: https://www.snapschool.academy/sign-in`,
      `Admin email: ${ADMIN_EMAIL}`,
      `Admin password: ${adminPassword}`,
      `Parent phone: ${PARENT_PHONE}`,
      `Parent password: ${parentPassword}`,
      `Parent children: Yasmine Ben Salah (DEMO0001), Aziz Ben Salah (DEMO0002)`,
    ].join("\n") + "\n",
    { mode: 0o600 },
  );

  const counts = await Promise.all([
    prisma.student.count({ where: { schoolId: SCHOOL_ID } }),
    prisma.teacher.count({ where: { schoolId: SCHOOL_ID } }),
    prisma.parent.count({ where: { schoolId: SCHOOL_ID } }),
    prisma.class.count({ where: { schoolId: SCHOOL_ID } }),
    prisma.grade.count({ where: { schoolId: SCHOOL_ID } }),
    prisma.attendance.count({ where: { schoolId: SCHOOL_ID } }),
  ]);
  console.log(JSON.stringify({ schoolId: SCHOOL_ID, students: counts[0], teachers: counts[1], parents: counts[2], classes: counts[3], grades: counts[4], attendance: counts[5], credentialsPath: CREDENTIALS_PATH }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
