"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getSchoolConfig() {
  try {
    let config = await prisma.institution.findFirst({
      where: { schoolId: "default_school" },
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
      where: { schoolId: data.schoolId || "default_school" },
      update: updateData,
      create: { 
        ...updateData, 
        schoolId: data.schoolId || "default_school",
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
