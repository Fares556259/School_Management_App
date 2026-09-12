import prisma from "@/lib/prisma";

export interface LinkCodeResult {
  code: string;
  expiresAt: Date;
  botUrl: string;
}

/**
 * Generate a 6-digit temporary linking code for an admin.
 * Admin can enter this code in Telegram or click the deep link:
 * https://t.me/HniaSnapSchoolBot?start=CODE
 */
export async function generateLinkCode(adminId: string, schoolId: string): Promise<LinkCodeResult> {
  // Generate random 6-digit number string
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Check if admin already has a TelegramAccount record
  const existing = await prisma.telegramAccount.findUnique({
    where: { adminId },
  });

  if (existing) {
    await prisma.telegramAccount.update({
      where: { adminId },
      data: {
        linkCode: code,
        linkCodeExpiry: expiresAt,
      },
    });
  } else {
    await prisma.telegramAccount.create({
      data: {
        telegramId: `pending_${adminId}_${Date.now()}`,
        adminId,
        schoolId,
        linkCode: code,
        linkCodeExpiry: expiresAt,
      },
    });
  }

  const botUrl = `https://t.me/HniaSnapSchoolBot?start=${code}`;

  return {
    code,
    expiresAt,
    botUrl,
  };
}

export interface VerifyLinkResult {
  success: boolean;
  schoolName?: string;
  schoolId?: string;
  adminName?: string;
  adminId?: string;
  language?: string;
  error?: string;
}

/**
 * Verifies a 6-digit code sent by a Telegram user and links their Telegram ID
 */
export async function verifyAndLinkAccount(
  telegramId: string,
  telegramUsername: string | undefined,
  rawCode: string
): Promise<VerifyLinkResult> {
  const code = rawCode.trim();

  // Find the pending account with this valid code
  const candidate = await prisma.telegramAccount.findFirst({
    where: {
      linkCode: code,
      linkCodeExpiry: {
        gt: new Date(),
      },
    },
    include: {
      admin: {
        select: {
          id: true,
          name: true,
          surname: true,
          username: true,
        },
      },
      School: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!candidate) {
    return {
      success: false,
      error: "INVALID_OR_EXPIRED_CODE",
    };
  }

  // Check if this telegramId is already linked to another admin
  const existingWithSameTg = await prisma.telegramAccount.findUnique({
    where: { telegramId },
  });

  if (existingWithSameTg && existingWithSameTg.id !== candidate.id) {
    // Unlink old association to prevent duplicate key error
    await prisma.telegramAccount.delete({
      where: { id: existingWithSameTg.id },
    }).catch(() => null);
  }

  // Update candidate with the actual telegramId
  await prisma.telegramAccount.update({
    where: { id: candidate.id },
    data: {
      telegramId,
      telegramUsername: telegramUsername || null,
      linkCode: null,
      linkCodeExpiry: null,
    },
  });

  const adminName = [candidate.admin.name, candidate.admin.surname].filter(Boolean).join(" ") || candidate.admin.username;

  return {
    success: true,
    schoolName: candidate.School.name,
    schoolId: candidate.School.id,
    adminName,
    adminId: candidate.admin.id,
    language: candidate.language,
  };
}

/**
 * Retrieve linked TelegramAccount along with Admin and School data
 */
export async function getLinkedAccount(telegramId: string) {
  return await prisma.telegramAccount.findUnique({
    where: { telegramId },
    include: {
      admin: true,
      School: true,
    },
  });
}

/**
 * Update language preference
 */
export async function updateAccountLanguage(telegramId: string, language: "fr" | "ar" | "en") {
  return await prisma.telegramAccount.update({
    where: { telegramId },
    data: { language },
  });
}

/**
 * Unlink Telegram from Admin
 */
export async function unlinkAccount(adminId: string) {
  return await prisma.telegramAccount.deleteMany({
    where: { adminId },
  });
}
