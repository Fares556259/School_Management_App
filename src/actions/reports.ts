"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addSubscriber(formData: FormData) {
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;

  if (!email) return;

  try {
    await prisma.reportSubscriber.create({
      data: { email, name },
    });
    revalidatePath("/admin/reports");
  } catch (err: any) {
    console.error("Failed to add subscriber", err);
  }
}

export async function removeSubscriber(id: string) {
  try {
    await prisma.reportSubscriber.delete({
      where: { id },
    });
    revalidatePath("/admin/reports");
  } catch (err) {
    console.error("Failed to remove subscriber", err);
  }
}
