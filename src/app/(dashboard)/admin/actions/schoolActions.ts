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
        }
      });
    }

    return { success: true, data: config };
  } catch (error: any) {
    console.error("Error fetching school config:", error);
    return { success: false, error: error.message };
  }
}

export async function updateSchoolConfig(data: any) {
  try {
    const updated = await prisma.schoolConfig.upsert({
      where: { id: 1 },
      update: {
        ...data,
        id: 1 // Ensure ID stays 1
      },
      create: {
        ...data,
        id: 1
      }
    });

    revalidatePath("/settings");
    revalidatePath("/list/exams");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Error updating school config:", error);
    return { success: false, error: error.message };
  }
}
