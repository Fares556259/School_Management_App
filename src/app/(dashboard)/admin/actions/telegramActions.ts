"use server";

import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import { getSchoolId } from "@/lib/school";
import { generateLinkCode, unlinkAccount } from "@/lib/telegram/linking";
import { revalidatePath } from "next/cache";

export async function getTelegramLinkStatus() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Non authentifié" };

    const account = await prisma.telegramAccount.findUnique({
      where: { adminId: user.id },
      include: { School: { select: { name: true } } },
    });

    if (!account || account.telegramId.startsWith("pending_")) {
      return {
        success: true,
        isLinked: false,
        linkCode: account?.linkCode || null,
        linkCodeExpiry: account?.linkCodeExpiry ? account.linkCodeExpiry.toISOString() : null,
      };
    }

    return {
      success: true,
      isLinked: true,
      telegramUsername: account.telegramUsername || null,
      telegramId: account.telegramId,
      language: account.language,
      dailyBriefing: account.dailyBriefing,
      linkedAt: account.updatedAt.toISOString(),
      schoolName: account.School.name,
    };
  } catch (err: any) {
    console.error("[getTelegramLinkStatus] Error:", err);
    return { success: false, error: err.message };
  }
}

export async function requestTelegramLinkCode() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Non authentifié" };

    const schoolId = await getSchoolId();
    const result = await generateLinkCode(user.id, schoolId);

    revalidatePath("/settings");
    revalidatePath("/list/assistant");

    return {
      success: true,
      code: result.code,
      expiresAt: result.expiresAt.toISOString(),
      botUrl: result.botUrl,
    };
  } catch (err: any) {
    console.error("[requestTelegramLinkCode] Error:", err);
    return { success: false, error: err.message };
  }
}

export async function disconnectTelegramAccount() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Non authentifié" };

    await unlinkAccount(user.id);

    revalidatePath("/settings");
    revalidatePath("/list/assistant");

    return { success: true };
  } catch (err: any) {
    console.error("[disconnectTelegramAccount] Error:", err);
    return { success: false, error: err.message };
  }
}
