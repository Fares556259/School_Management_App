import { Day, PrismaClient, UserSex, PaymentStatus } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Initializing Master Seed Generation...");

  // 1. CLEANUP (Nuclear Option)
  console.log("🧹 Wiping database for a clean start...");
  await prisma.auditLog.deleteMany();
  await prisma.income.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.gradeSheet.deleteMany();
  await prisma.result.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.level.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.notice.deleteMany();

  // 2. CORE INFRASTRUCTURE
  console.log("🏗️ Seeding Core Infrastructure (Admins, Levels, Subjects)...");
  await prisma.admin.create({ data: { id: "admin1", username: "admin1", name: "Fares", surname: "Admin" } });

  const levels = [];
  for (let i = 1; i <= 6; i++) {
    const level = await prisma.level.create({ data: { level: i } });
    levels.push(level);
  }

  const subjectData = [
    { name: "Arabe", domain: "Langues" },
    { name: "Français", domain: "Langues" },
    { name: "Anglais", domain: "Langues" },
    { name: "Mathématiques", domain: "Sciences" },
    { name: "Sciences de la Vie", domain: "Sciences" },
    { name: "Technologie", domain: "Sciences" },
    { name: "Histoire", domain: "Sciences Humaines" },
    { name: "Géographie", domain: "Sciences Humaines" },
    { name: "Éducation Civique", domain: "Sciences Humaines" },
    { name: "Éducation Islamique", domain: "Sciences Humaines" },
    { name: "Éducation Physique", domain: "Arts & Sport" },
    { name: "Arts Plastiques", domain: "Arts & Sport" },
    { name: "Musique", domain: "Arts & Sport" }
  ];

  const subjects = [];
  for (const s of subjectData) {
    const created = await prisma.subject.create({ data: s });
    subjects.push(created);
  }

  // 3. PERSONNEL (Teachers & Staff)
  console.log("👨‍🏫 Seeding Personnel (Teachers & Staff)...");
  const teachers = [];
  for (let i = 1; i <= 20; i++) {
    const t = await prisma.teacher.create({
      data: {
        id: `teacher${i}`,
        username: `teacher${i}`,
        name: `Mondher`,
        surname: `Ben Salem ${i}`,
        email: `teacher${i}@snapschool.tn`,
        phone: `98000${i.toString().padStart(3, '0')}`,
        address: "Tunis, Tunisie",
        bloodType: "A+",
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        birthday: new Date("1985-06-15"),
        salary: 2500 + (Math.random() * 1000),
        subjects: { connect: [{ id: subjects[i % subjects.length].id }] }
      }
    });
    teachers.push(t);
  }

  const staff = [];
  for (let i = 1; i <= 8; i++) {
    const s = await prisma.staff.create({
      data: {
        id: `staff${i}`,
        username: `staff${i}`,
        name: `Sami`,
        surname: `Administrateur ${i}`,
        email: `staff${i}@snapschool.tn`,
        phone: `22000${i.toString().padStart(3, '0')}`,
        address: "Ariana, Tunisie",
        bloodType: "O+",
        salary: 1200 + (Math.random() * 500),
        birthday: new Date("1990-09-20"),
        role: i % 2 === 0 ? "Comptable" : "Surveillant"
      }
    });
    staff.push(s);
  }

  // 4. CLASSES (18 sections)
  console.log("🏢 Seeding Classes...");
  const classes = [];
  for (let i = 0; i < 6; i++) {
    for (const section of ["A", "B", "C"]) {
      const classObj = await prisma.class.create({
        data: {
          name: `${i + 1}${section}`,
          levelId: levels[i].id,
          capacity: 25,
          supervisorId: teachers[i % teachers.length].id
        }
      });
      classes.push(classObj);
    }
  }

  // 5. PARENTS & STUDENTS (300 total)
  console.log("👨‍👩‍👧‍👦 Seeding Parents and Students (300)...");
  for (let i = 1; i <= 150; i++) {
    await prisma.parent.create({
      data: {
        id: `parent${i}`,
        username: `parent${i}`,
        name: `Yassine`,
        surname: `Parent ${i}`,
        email: `parent${i}@gmail.com`,
        phone: `55000${i.toString().padStart(3, '0')}`,
        address: "Cité El Khadra, Tunis"
      }
    });
  }

  const students = [];
  for (let i = 1; i <= 300; i++) {
    const s = await prisma.student.create({
      data: {
        id: `student${i}`,
        username: `student${i}`,
        name: `Amine`,
        surname: `Student ${i}`,
        address: "Tunis",
        bloodType: "B-",
        sex: i % 2 === 0 ? UserSex.MALE : UserSex.FEMALE,
        parentId: `parent${Math.ceil(i/2)}`,
        levelId: levels[Math.floor((i-1)/50)].id,
        classId: classes[Math.floor((i-1)/16.6) % classes.length].id,
        birthday: new Date("2016-01-01")
      }
    });
    students.push(s);
  }

  // 6. FINANCIALS (Expenses, Incomes, Payments)
  console.log("💰 Seeding Financial History (2026)...");
  const currentYear = 2026;
  const expenseCats = ["Factures", "Fournitures", "Maintenance", "Loyer", "Marketing"];
  const incomeCats = ["Dons", "Cantine", "Transport", "Frais Inscription"];

  for (let m = 1; m <= 12; m++) {
    // Random general expenses
    for (let j = 0; j < 4; j++) {
      await prisma.expense.create({
        data: {
          title: `${expenseCats[j % expenseCats.length]} - M${m}`,
          amount: 300 + Math.random() * 700,
          category: expenseCats[j % expenseCats.length],
          date: new Date(currentYear, m - 1, 10 + j)
        }
      });
    }
    // Random general incomes
    for (let j = 0; j < 3; j++) {
      await prisma.income.create({
        data: {
          title: `${incomeCats[j % incomeCats.length]} - M${m}`,
          amount: 600 + Math.random() * 1200,
          category: incomeCats[j % incomeCats.length],
          date: new Date(currentYear, m - 1, 15 + j)
        }
      });
    }
  }

  // Detailed Payments (Tuition/Salaries)
  console.log("💸 Seeding Detailed Monthly Payments...");
  for (let m = 1; m <= 4; m++) {
    const isPast = m < 4;
    // Jan-Mar: 90% paid, Apr: 30% paid
    const studentPayProbability = m < 4 ? 0.9 : 0.3;

    for (const s of students) {
        const status = Math.random() < studentPayProbability ? PaymentStatus.PAID : PaymentStatus.PENDING;
        await prisma.payment.create({
            data: {
                studentId: s.id,
                amount: 250,
                month: m,
                year: currentYear,
                status: status,
                userType: "STUDENT",
                paidAt: status === PaymentStatus.PAID ? new Date(currentYear, m - 1, 5) : null
            }
        });
    }

    for (const t of teachers) {
        const status = isPast ? PaymentStatus.PAID : PaymentStatus.PENDING;
        await prisma.payment.create({
            data: {
                teacherId: t.id,
                amount: t.salary,
                month: m,
                year: currentYear,
                status: status,
                userType: "TEACHER",
                paidAt: status === PaymentStatus.PAID ? new Date(currentYear, m - 1, 25) : null
            }
        });
    }

    for (const st of staff) {
        const status = isPast ? PaymentStatus.PAID : PaymentStatus.PENDING;
        await prisma.payment.create({
            data: {
                staffId: st.id,
                amount: st.salary,
                month: m,
                year: currentYear,
                status: status,
                userType: "STAFF",
                paidAt: status === PaymentStatus.PAID ? new Date(currentYear, m - 1, 28) : null
            }
        });
    }
  }

  // 7. ACADEMICS (Timetable & Grades)
  console.log("📅 Seeding Academic Data (Timetable & Grades)...");
  // Seed Grades for Term 1 (All students)
  for (let i = 0; i < 50; i++) { // Sample for performance, or use more
      const student = students[i];
      for (const subject of subjects.slice(0, 5)) {
          await prisma.grade.create({
              data: {
                  studentId: student.id,
                  subjectId: subject.id,
                  term: 1,
                  score: 10 + Math.random() * 10
              }
          });
      }
  }

  // 8. NOTICES & AUDITS
  console.log("📜 Seeding Notices and Audit Trail...");
  const notices = [
    { title: "Réunion Parents-Enseignants", message: "La réunion aura lieu ce samedi à 10h.", important: true },
    { title: "Vacances de Printemps", message: "Les cours reprendront le lundi suivant.", important: false },
    { title: "Nouveaux Clubs", message: "Inscrivez-vous aux clubs de robotique et de théâtre.", important: false }
  ];
  for (const n of notices) await prisma.notice.create({ data: n });

  const auditActions = ["PAIEMENT_RECU", "ETUDIANT_INSCRIT", "NOTE_MODIFIEE", "DEPENSE_ENREGISTREE"];
  for (let i = 1; i <= 30; i++) {
      await prisma.auditLog.create({
          data: {
              action: auditActions[i % auditActions.length],
              performedBy: "admin1",
              entityType: "SYSTEM",
              description: `Action de test numéro ${i} enregistrée dans le journal d'audit.`,
              timestamp: new Date(Date.now() - (i * 3600000))
          }
      });
  }

  console.log("✅ Master Seeding Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
