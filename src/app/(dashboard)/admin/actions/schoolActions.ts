"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getSchoolConfig() {
  try {
    let config = await prisma.schoolConfig.findFirst({
      where: { id: 1 }
    });

    if (!config) {
      config = await prisma.schoolConfig.create({
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
        }
      });
    }

    // Ensure we always have these fields even if they were null in existing records
    if (config) {
      if (!config.yearStart) (config as any).yearStart = new Date("2025-09-01");
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
    const currentConfig = await prisma.schoolConfig.findFirst({ where: { id: 1 } });
    const oldSessions = currentConfig?.sessions ? (typeof currentConfig.sessions === 'string' ? JSON.parse(currentConfig.sessions as string) : currentConfig.sessions as any[]) : [];
    const newSessions = data.sessions || [];

    // 2. Prepare data for update with proper type conversion
    // We remove schoolId and updatedAt because Prisma handles them or 
    // expects them in a specific relation format.
    const { schoolId, updatedAt, ...sanitizedData } = data;

    const updateData = {
      ...sanitizedData,
      id: 1,
      // Convert date strings from <input type="date"> to Date objects for Prisma
      yearStart: data.yearStart ? new Date(data.yearStart) : undefined,
      yearEnd: data.yearEnd ? new Date(data.yearEnd) : undefined,
      // Ensure holidays is a valid JSON object/array
      holidays: data.holidays ? (typeof data.holidays === 'string' ? JSON.parse(data.holidays) : data.holidays) : undefined,
    };

    // 2. Update the SchoolConfig
    const updated = await prisma.schoolConfig.upsert({
      where: { id: 1 },
      update: updateData,
      create: updateData
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
