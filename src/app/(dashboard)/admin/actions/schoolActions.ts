"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSchoolId } from "@/lib/school";

export async function getSchoolConfig() {
  try {
    const schoolId = await getSchoolId();
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
        academicYear: true,
        currentSemester: true,
        sessions: true,
        holidays: true,
        yearStart: true,
        yearEnd: true,
        updatedAt: true
      }
    });

    if (!config) {
      config = await prisma.institution.create({
        data: {
          id: 1,
          schoolName: "Ecole Supérieure de la Statistique et de l'Analyse de l'Information",
          ministryName: "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique",
          universityName: "Université de Carthage",
          academicYear: "2025-2026",
          currentSemester: 2,
          yearStart: new Date("2025-09-01"),
          yearEnd: new Date("2026-06-30"),
          holidays: [],
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
          academicYear: true,
          currentSemester: true,
          sessions: true,
          holidays: true,
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
    }

    return { success: true, data: config };
  } catch (error: any) {
    console.error("Error fetching school config:", error);
    return { success: false, error: error.message };
  }
}

export async function updateSchoolConfig(data: any) {
  try {
    // 1. Fetch current config to check for session count changes
    const currentConfig = await prisma.institution.findFirst({ 
      where: { id: 1 },
      select: { sessions: true } 
    });
    const oldSessions = currentConfig?.sessions ? (typeof currentConfig.sessions === 'string' ? JSON.parse(currentConfig.sessions as string) : currentConfig.sessions as any[]) : [];
    const newSessions = data.sessions || [];

    // 2. Prepare data for update with strict field mapping and validation
    const updateData: any = {
      schoolName: data.schoolName,
      schoolLogo: data.schoolLogo,
      ministryName: data.ministryName,
      ministryLogo: data.ministryLogo,
      universityName: data.universityName,
      universityLogo: data.universityLogo,
      academicYear: data.academicYear,
      currentSemester: data.currentSemester,
      holidays: data.holidays || [],
      sessions: data.sessions || [],
    };

    // Safely handle dates to avoid "Invalid Date" Prisma errors
    const start = data.yearStart ? new Date(data.yearStart) : null;
    if (start && !isNaN(start.getTime())) updateData.yearStart = start;
    
    const end = data.yearEnd ? new Date(data.yearEnd) : null;
    if (end && !isNaN(end.getTime())) updateData.yearEnd = end;

    // 2. Update the Institution (using schoolId as resilient unique key)
    const updated = await prisma.institution.upsert({
      where: { schoolId: data.schoolId || await getSchoolId() },
      update: updateData,
      create: { 
        ...updateData, 
        schoolId: data.schoolId || await getSchoolId(),
        id: 1 
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
        academicYear: true,
        currentSemester: true,
        sessions: true,
        holidays: true,
        yearStart: true,
        yearEnd: true,
        updatedAt: true
      }
    });

    // 3. Synchronize TimetableSlots
    if (Array.isArray(newSessions)) {
      await Promise.all(newSessions.map(async (session: any, index: number) => {
        if (session.time && session.time.includes(" - ")) {
          const [start, end] = session.time.split(" - ");
          const slotNumber = index + 1;

          await prisma.timetableSlot.updateMany({
            where: { slotNumber },
            data: {
              startTime: start.trim(),
              endTime: end.trim()
            }
          });
        }
      }));

      // 4. Cleanuporphaned slots if session count decreased
      if (newSessions.length < oldSessions.length) {
        await prisma.timetableSlot.deleteMany({
          where: {
            slotNumber: { gt: newSessions.length }
          }
        });
      }
    }

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

    // Ensure levels 1-6 exist by default
    const standardLevels = [1, 2, 3, 4, 5, 6];
    await Promise.all(standardLevels.map(lvl => 
      prisma.level.upsert({
        where: { level_schoolId: { level: lvl, schoolId } },
        update: {},
        create: { level: lvl, tuitionFee: 450, schoolId }
      })
    ));

    const levels = await prisma.level.findMany({
      select: {
        id: true,
        level: true,
        tuitionFee: true,
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
    const levels = await prisma.level.findMany({
      select: { id: true, level: true }
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
    const level = await prisma.level.findUnique({
      where: { id: levelId },
      select: { level: true, schoolId: true }
    });

    if (!level) throw new Error("Level not found");

    const targetNames = Array.from({ length: count }, (_, i) => 
      `${level.level}${String.fromCharCode(65 + i)}`
    );

    // 1. Create/Update variations
    for (const name of targetNames) {
      await prisma.class.upsert({
        where: {
          name_schoolId: {
            name: name,
            schoolId: level.schoolId
          }
        },
        update: {
          levelId: levelId // Ensure it belongs to this level
        },
        create: {
          name,
          levelId,
          schoolId: level.schoolId,
          capacity: 30
        }
      });
    }

    // 2. Identify and attempt to remove excess variations (only if count < current)
    const currentVariations = await prisma.class.findMany({
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

    let errors: string[] = [];
    for (const cls of currentVariations) {
      if (!targetNames.includes(cls.name)) {
        // This class is no longer in the target set
        if (cls._count.students > 0 || cls._count.lessons > 0 || cls._count.timetable > 0) {
          errors.push(`Cannot remove class ${cls.name}: It has active students or scheduled lessons.`);
        } else {
          await prisma.class.delete({ where: { id: cls.id } });
        }
      }
    }

    revalidatePath("/settings");
    revalidatePath("/admin");
    return { success: true, errors: errors.length > 0 ? errors : null };
  } catch (error: any) {
    console.error("Error syncing variations:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteClass(id: number) {
  try {
    await prisma.class.delete({
      where: { id }
    });
    revalidatePath("/settings");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting class:", error);
    return { success: false, error: error.message };
  }
}

export async function addSettingsClass(data: { name: string, levelId: number }) {
  try {
    const newClass = await prisma.class.create({
      data: {
        name: data.name,
        levelId: data.levelId,
        capacity: 30, // Default capacity
      }
    });
    revalidatePath("/settings");
    revalidatePath("/admin");
    return { success: true, data: newClass };
  } catch (error: any) {
    console.error("Error creating class from settings:", error);
    return { success: false, error: error.message };
  }
}
