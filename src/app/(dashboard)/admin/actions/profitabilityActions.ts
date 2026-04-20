"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type SimulationState = {
  name: string;
  tuitionAdjust: number;
  salaryAdjust: number;
  overheadAdjust: number;
  targetStudents: number;
  description?: string;
};

export async function saveScenario(data: SimulationState) {
  try {
    const scenario = await prisma.profitabilityScenario.create({
      data: {
        ...data,
        schoolId: "default_school", // Logic for school isolation
      },
    });

    revalidatePath("/admin/finance/simulator");
    return { success: true, scenario };
  } catch (error: any) {
    console.error("Failed to save profitability scenario:", error);
    return { success: false, error: error.message };
  }
}

export async function getScenarios() {
  try {
    const scenarios = await prisma.profitabilityScenario.findMany({
      where: { schoolId: "default_school" },
      orderBy: { updatedAt: "desc" },
    });

    return { success: true, data: scenarios };
  } catch (error: any) {
    console.error("Failed to fetch profitability scenarios:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteScenario(id: string) {
  try {
    await prisma.profitabilityScenario.delete({
      where: { id },
    });

    revalidatePath("/admin/finance/simulator");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete profitability scenario:", error);
    return { success: false, error: error.message };
  }
}
