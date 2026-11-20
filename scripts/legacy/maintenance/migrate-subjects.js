const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const arabicComponents = ["التواصل الشفوي", "الخط", "القراءة", "الإنتاج الكتابي", "Communication Orale", "Écriture", "Lecture", "Production Écrite"];
const frenchComponents = ["Expression Orale", "Lecture (Français)", "Production Écrite (Français)", "التعبير الشفوي (فرنسية)", "القراءة (فرنسية)", "الإنتاج الكتابي (فرنسية)", "Grammaire"];

async function migrate() {
  console.log("Starting Subject Migration...");
  
  const schools = await prisma.school.findMany({ select: { id: true } });
  
  for (const school of schools) {
    const schoolId = school.id;
    console.log(`\nProcessing school: ${schoolId}`);
    
    // 1. Fetch all subjects for this school
    const subjects = await prisma.subject.findMany({ where: { schoolId } });
    
    // 2. Ensure Parent Subjects exist
    let arabicParent = subjects.find(s => s.name.includes("اللغة العربية") || s.name.includes("Arabic Language"));
    if (!arabicParent) {
      console.log("Creating Arabic Parent...");
      arabicParent = await prisma.subject.create({
        data: { name: "اللغة العربية | Langue Arabe | Arabic Language", domain: "Arabic Language Domain", schoolId }
      });
      subjects.push(arabicParent);
    }
    
    let frenchParent = subjects.find(s => s.name.includes("اللغة الفرنسية") || s.name.includes("French Language"));
    if (!frenchParent) {
      console.log("Creating French Parent...");
      frenchParent = await prisma.subject.create({
        data: { name: "اللغة الفرنسية | Langue Française | French Language", domain: "Foreign Languages Domain", schoolId }
      });
      subjects.push(frenchParent);
    }
    
    // 3. Link Components
    for (const subject of subjects) {
      if (subject.id === arabicParent.id || subject.id === frenchParent.id) continue;
      
      let isArabic = arabicComponents.some(c => subject.name.includes(c)) && !subject.name.includes("(فرنسية)") && !subject.name.includes("Français");
      let isFrench = frenchComponents.some(c => subject.name.includes(c)) || subject.name.includes("(فرنسية)") || subject.name.includes("Français") || subject.name.includes("Expression Orale");
      
      // Special case for Grammar which can be in both languages depending on the name
      if (subject.name.includes("قواعد اللغة")) {
        if (subject.name.includes("Grammaire") || subject.name.includes("French")) isFrench = true;
        else isArabic = true;
      }
      
      if (isArabic) {
        await prisma.subject.update({ where: { id: subject.id }, data: { parentId: arabicParent.id } });
        console.log(`Linked ${subject.name} -> Arabic`);
      } else if (isFrench) {
        await prisma.subject.update({ where: { id: subject.id }, data: { parentId: frenchParent.id } });
        console.log(`Linked ${subject.name} -> French`);
      } else {
        // Standalone subject, ensure parentId is null
        if (subject.parentId !== null) {
          await prisma.subject.update({ where: { id: subject.id }, data: { parentId: null } });
        }
      }
    }
    
    // 4. Fix Timetable Slots
    const slots = await prisma.timetableSlot.findMany({ where: { schoolId }, include: { subject: true } });
    for (const slot of slots) {
      if (slot.subject && slot.subject.parentId) {
        console.log(`Updating TimetableSlot ${slot.id}: ${slot.subject.name} -> Parent ID ${slot.subject.parentId}`);
        await prisma.timetableSlot.update({
          where: { id: slot.id },
          data: { subjectId: slot.subject.parentId }
        });
      }
    }
    
    // 5. Fix Teacher Assignments
    const teachers = await prisma.teacher.findMany({ where: { schoolId }, include: { subjects: true } });
    for (const teacher of teachers) {
      const parentSubjectIdsToAdd = new Set();
      const childSubjectIdsToRemove = [];
      
      for (const subject of teacher.subjects) {
        if (subject.parentId) {
          childSubjectIdsToRemove.push(subject.id);
          parentSubjectIdsToAdd.add(subject.parentId);
        }
      }
      
      if (childSubjectIdsToRemove.length > 0) {
        console.log(`Updating Teacher ${teacher.username}...`);
        await prisma.teacher.update({
          where: { id: teacher.id },
          data: {
            subjects: {
              disconnect: childSubjectIdsToRemove.map(id => ({ id })),
              connect: Array.from(parentSubjectIdsToAdd).map(id => ({ id }))
            }
          }
        });
      }
    }
  }
  
  console.log("\nMigration completed successfully!");
}

migrate().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
