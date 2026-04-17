"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type SetupRequestState = {
  success?: boolean;
  error?: string;
};

export async function submitSetupRequest(
  prevState: SetupRequestState,
  formData: FormData
): Promise<SetupRequestState> {
  const schoolName = formData.get("schoolName") as string;
  const ownerName = formData.get("ownerName") as string;
  const phoneNumber = formData.get("phoneNumber") as string;
  const city = formData.get("city") as string;

  if (!schoolName || !ownerName || !phoneNumber || !city) {
    return { error: "All fields are required." };
  }

  try {
    await prisma.setupRequest.create({
      data: {
        schoolName,
        ownerName,
        phoneNumber,
        city,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("Setup Request Error:", err);
    return { error: "Something went wrong. Please try again or contact us via WhatsApp." };
  }
}
