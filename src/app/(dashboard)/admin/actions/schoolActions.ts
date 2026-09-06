"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSchoolId } from "@/lib/school";
import { invalidateTenantTags } from "@/lib/cache";

export async function getSchoolConfig(tenantId?: string) {
  try {
    const schoolId = tenantId || await getSchoolId();
    let config = await prisma.institution.findFirst({
      where: { schoolId },
      select: {
        id: true,
        schoolId: true,
        schoolName: true,
        schoolLogo: true,
        ministryName: true,
        ministryLogo: true,
        universityName: true,
        universityLogo: true,
        phone: true,
        address: true,
        academicYear: true,
        currentSemester: true,
        sessions: true,
        holidays: true,
        dayStartTime: true,
        dayEndTime: true,
        yearStart: true,
        yearEnd: true,
        updatedAt: true
      }
    });

    if (!config) {
      config = await prisma.institution.upsert({
        where: { schoolId },
        update: {},
        create: {
          schoolId: schoolId,
          schoolName: "Ecole Supérieure de la Statistique et de l'Analyse de l'Information",
          ministryName: "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique",
          universityName: "Université de Carthage",
          phone: "+216 71 000 000",
          address: "123 Education Ave, Tunis",
          academicYear: "2025-2026",
          currentSemester: 2,
          yearStart: new Date("2025-09-01"),
          yearEnd: new Date("2026-06-30"),
          holidays: [],
          dayStartTime: "08:00",
          dayEndTime: "14:00",
        },
        select: {
          id: true,
          schoolId: true,
          schoolName: true,
          schoolLogo: true,
          ministryName: true,
          ministryLogo: true,
          universityName: true,
          universityLogo: true,
          phone: true,
          address: true,
          academicYear: true,
          currentSemester: true,
          sessions: true,
          holidays: true,
          dayStartTime: true,
          dayEndTime: true,
          yearStart: true,
          yearEnd: true,
          updatedAt: true
        }
      });
    }

    // Ensure we always have these fields even if they were null in existing records
    if (config) {
      if (!config.yearEnd) (config as any).yearEnd = new Date("2026-06-30");
      if (!config.holidays) (config as any).holidays = [];
      if (!(config as any).dayStartTime) (config as any).dayStartTime = "08:00";
      if (!(config as any).dayEndTime) (config as any).dayEndTime = "14:00";
    }

    return { success: true, data: config };
  } catch (error: any) {
    console.error("Error fetching school config:", error);
    return { success: false, error: error.message };
  }
}


export async function updateSchoolConfig(data: any) {
  try {
    const schoolId = await getSchoolId();

    // Prepare data for update
    const updateData: any = {
      schoolName: data.schoolName,
      schoolLogo: data.schoolLogo,
      ministryName: data.ministryName,
      ministryLogo: data.ministryLogo,
      universityName: data.universityName,
      universityLogo: data.universityLogo,
      phone: data.phone || "+216 71 000 000",
      address: data.address || "123 Education Ave, Tunis",
      academicYear: data.academicYear,
      currentSemester: data.currentSemester,
      holidays: data.holidays || [],
      sessions: data.sessions || [],
      dayStartTime: data.dayStartTime || "08:00",
      dayEndTime: data.dayEndTime || "14:00",
    };

    // Safely handle dates
    const start = data.yearStart ? new Date(data.yearStart) : null;
    if (start && !isNaN(start.getTime())) updateData.yearStart = start;
    const end = data.yearEnd ? new Date(data.yearEnd) : null;
    if (end && !isNaN(end.getTime())) updateData.yearEnd = end;

    const updated = await prisma.institution.upsert({
      where: { schoolId: data.schoolId || schoolId },
      update: updateData,
      create: { ...updateData, schoolId: data.schoolId || schoolId },
      select: {
        id: true,
        schoolId: true,
        schoolName: true,
        schoolLogo: true,
        ministryName: true,
        ministryLogo: true,
        universityName: true,
        universityLogo: true,
        phone: true,
        address: true,
        academicYear: true,
        currentSemester: true,
        sessions: true,
        holidays: true,
        dayStartTime: true,
        dayEndTime: true,
        yearStart: true,
        yearEnd: true,
        updatedAt: true
      }
    });

    revalidatePath("/settings");
    revalidatePath("/list/exams");
    revalidatePath("/admin/timetable");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Error updating school config:", error);
    return { success: false, error: error.message };
  }
}


export async function getLevelTuitionFees() {

  try {
    const schoolId = await getSchoolId();

    // 1. Fetch existing levels first to see what's missing
    const existingLevels = await prisma.level.findMany({
      where: { schoolId },
      select: { level: true }
    });
    const existingLevelNumbers = existingLevels.map(l => l.level);

    // 2. Identify missing standard levels (0 = Préscolaire, 1-6 = Primaire)
    const standardLevels = [0, 1, 2, 3, 4, 5, 6];
    const missingLevels = standardLevels.filter(lvl => !existingLevelNumbers.includes(lvl));

    // 3. Create missing levels in bulk if any
    if (missingLevels.length > 0) {
      await prisma.level.createMany({
        data: missingLevels.map(lvl => ({
          level: lvl,
          tuitionFee: 450,
          schoolId
        })),
        skipDuplicates: true
      });
    }

    const levels = await prisma.level.findMany({
      where: { schoolId },
      select: {
        id: true,
        level: true,
        tuitionFee: true,
        variations: true,
        classes: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { level: 'asc' }
    });
    return { success: true, data: levels };
  } catch (error: any) {
    console.error("Error fetching level fees:", error);
    return { success: false, error: error.message };
  }
}

export async function updateLevelTuitionFee(id: number, fee: number) {
  try {
    const updated = await prisma.level.update({
      where: { id },
      data: { tuitionFee: fee }
    });
    revalidatePath("/settings");
    revalidatePath("/admin");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Error updating level fee:", error);
    return { success: false, error: error.message };
  }
}

export async function getLevels() {
  try {
    const schoolId = await getSchoolId();
    const levels = await prisma.level.findMany({
      where: { schoolId },
      select: { id: true, level: true },
      orderBy: { level: 'asc' }
    });
    return { success: true, data: levels };
  } catch (error: any) {
    console.error("Error fetching levels:", error);
    return { success: false, error: error.message };
  }
}

export async function addLevel(level: number, tuitionFee: number) {
  try {
    const schoolId = await getSchoolId();
    const newLevel = await prisma.level.create({
      data: { level, tuitionFee, schoolId },
    });
    revalidatePath("/settings");
    revalidatePath("/admin");
    return { success: true, data: newLevel };
  } catch (error: any) {
    console.error("Error adding level:", error);
    return { success: false, error: error.message };
  }
}

export async function syncLevelVariations(levelId: number, count: number) {
  try {
    const updatedLevel = await prisma.level.update({
      where: { id: levelId },
      data: { variations: count },
      select: { level: true }
    });

    // Clean up empty classes that exceed the new variations limit
    const classes = await prisma.class.findMany({
      where: { levelId },
      include: {
        _count: {
          select: {
            students: true,
            lessons: true,
            timetable: true
          }
        }
      }
    });

    const schoolId = await getSchoolId();
    const ARABIC_LETTERS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م", "ن", "س", "ع", "ف", "ص", "ق", "ر", "ش", "ت", "ث", "خ", "ذ", "ض", "ظ", "غ"];
    let errors: string[] = [];

    const targetNames = Array.from({ length: count }, (_, i) => 
      updatedLevel.level === 0
        ? `تحضيري ${ARABIC_LETTERS[i] || String.fromCharCode(65 + i)}`
        : `${updatedLevel.level}${String.fromCharCode(65 + i)}`
    );

    // Clean up empty classes that exceed the new variations limit
    for (const cls of classes) {
      if (!targetNames.includes(cls.name)) {
        if (cls._count.students > 0 || cls._count.lessons > 0 || cls._count.timetable > 0) {
          errors.push(`Cannot remove class ${cls.name}: It has active students or scheduled lessons.`);
        } else {
          await prisma.class.delete({ where: { id: cls.id } });
        }
      }
    }

    if (schoolId) {
      invalidateTenantTags(schoolId, 'classes', 'students');
    }
    revalidatePath("/settings");
    revalidatePath("/admin");
    revalidatePath("/list/classes");
    revalidatePath("/list/students");
    return { success: true, errors: errors.length > 0 ? errors : null };
  } catch (error: any) {
    console.error("Error syncing variations:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteClass(id: number) {
  try {
    const schoolId = await getSchoolId();
    await prisma.class.delete({
      where: { id }
    });
    if (schoolId) {
      invalidateTenantTags(schoolId, 'classes', 'students');
    }
    revalidatePath("/settings");
    revalidatePath("/admin");
    revalidatePath("/list/classes");
    revalidatePath("/list/students");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting class:", error);
    return { success: false, error: error.message };
  }
}

export async function addSettingsClass(data: { name: string, levelId: number }) {
  try {
    const schoolId = await getSchoolId();
    const newClass = await prisma.class.create({
      data: {
        name: data.name,
        levelId: data.levelId,
        capacity: 30, // Default capacity
        schoolId,
      }
    });
    if (schoolId) {
      invalidateTenantTags(schoolId, 'classes', 'students');
    }
    revalidatePath("/settings");
    revalidatePath("/admin");
    revalidatePath("/list/classes");
    revalidatePath("/list/students");
    return { success: true, data: newClass };
  } catch (error: any) {
    console.error("Error creating class from settings:", error);
    return { success: false, error: error.message };
  }
}
