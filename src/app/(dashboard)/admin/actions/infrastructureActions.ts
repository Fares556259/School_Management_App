"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSchoolId } from "@/lib/school";

// --- ROOMS ---

export async function getRooms() {
  try {
    const schoolId = await getSchoolId();
    const rooms = await prisma.room.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' }
    });
    return { success: true, data: rooms };
  } catch (error: any) {
    console.error("Error fetching rooms:", error);
    return { success: false, error: error.message };
  }
}

export async function addRoom(name: string) {
  try {
    const schoolId = await getSchoolId();
    const room = await prisma.room.create({
      data: { name, schoolId }
    });
    revalidatePath("/settings");
    return { success: true, data: room };
  } catch (error: any) {
    console.error("Error adding room:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteRoom(id: number) {
  try {
    await prisma.room.delete({
      where: { id }
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting room:", error);
    return { success: false, error: error.message };
  }
}

export async function updateRoom(id: number, name: string) {
  try {
    const room = await prisma.room.update({
      where: { id },
      data: { name }
    });
    revalidatePath("/settings");
    return { success: true, data: room };
  } catch (error: any) {
    console.error("Error updating room:", error);
    return { success: false, error: error.message };
  }
}
