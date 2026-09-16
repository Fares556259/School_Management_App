import prisma from "@/lib/prisma";
import { invalidateTenantTags } from "@/lib/cache";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";

/**
 * Tool: get_admin_profile
 * Retrieves the current administrator's personal profile and preferences (/profile).
 */
export async function getAdminProfileTool(
  _args: Record<string, any>,
  context: ToolContext
) {
  const admin = await prisma.admin.findUnique({
    where: { id: context.adminId },
    include: {
      School: { select: { id: true, name: true, subdomain: true } },
      telegramAccount: { select: { language: true, dailyBriefing: true, telegramUsername: true } },
    },
  });

  if (!admin) {
    return {
      success: false,
      message: "Profil administrateur introuvable.",
    };
  }

  const fullName = [admin.name, admin.surname].filter(Boolean).join(" ") || admin.username;

  return {
    success: true,
    profile: {
      id: admin.id,
      username: admin.username,
      fullName,
      firstName: admin.name || "Non renseigné",
      lastName: admin.surname || "Non renseigné",
      email: admin.email || "Non renseigné",
      phone: admin.phone || "Non renseigné",
      avatarUrl: admin.img || null,
      schoolName: admin.School?.name || "SnapSchool",
      telegramUsername: admin.telegramAccount?.telegramUsername || null,
      language: admin.telegramAccount?.language || context.language || "fr",
      dailyBriefing: admin.telegramAccount?.dailyBriefing ?? true,
    },
  };
}

/**
 * Tool: update_admin_profile
 * Updates the administrator's personal profile (name, surname, phone, email, avatar/photo, preferences).
 */
export async function updateAdminProfileTool(
  args: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    img?: string;
    language?: "fr" | "ar" | "en";
    dailyBriefing?: boolean;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const admin = await prisma.admin.findUnique({
    where: { id: context.adminId },
    include: { telegramAccount: true },
  });

  if (!admin) {
    return {
      success: false,
      message: "Profil administrateur introuvable.",
      summary: "Admin introuvable",
    };
  }

  const adminUpdateData: any = {};
  const tgUpdateData: any = {};
  const changes: string[] = [];

  if (args.firstName && args.firstName.trim() !== admin.name) {
    adminUpdateData.name = args.firstName.trim();
    changes.push(`Prénom : <b>${args.firstName.trim()}</b>`);
  }

  if (args.lastName && args.lastName.trim() !== admin.surname) {
    adminUpdateData.surname = args.lastName.trim();
    changes.push(`Nom : <b>${args.lastName.trim()}</b>`);
  }

  if (args.phone && args.phone.trim() !== admin.phone) {
    const cleanPhone = args.phone.replace(/[\s\-\+]/g, "");
    adminUpdateData.phone = cleanPhone;
    changes.push(`Téléphone : <code>${cleanPhone}</code>`);
  }

  if (args.email && args.email.trim().toLowerCase() !== admin.email?.toLowerCase()) {
    adminUpdateData.email = args.email.trim().toLowerCase();
    changes.push(`Email : <code>${args.email.trim().toLowerCase()}</code>`);
  }

  if (args.img !== undefined) {
    adminUpdateData.img = args.img || null;
    changes.push(`Photo de profil mise à jour 🖼️`);
  }

  if (args.language && admin.telegramAccount && args.language !== admin.telegramAccount.language) {
    tgUpdateData.language = args.language;
    changes.push(`Langue de Hnia : <code>${args.language.toUpperCase()}</code>`);
  }

  if (args.dailyBriefing !== undefined && admin.telegramAccount && args.dailyBriefing !== admin.telegramAccount.dailyBriefing) {
    tgUpdateData.dailyBriefing = args.dailyBriefing;
    changes.push(`Briefing quotidien : <code>${args.dailyBriefing ? "Activé ✅" : "Désactivé ❌"}</code>`);
  }

  if (Object.keys(adminUpdateData).length === 0 && Object.keys(tgUpdateData).length === 0) {
    return {
      success: false,
      message: "Aucune modification spécifiée pour votre profil.",
      summary: "Aucune modification",
    };
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(adminUpdateData).length > 0) {
      await tx.admin.update({
        where: { id: context.adminId },
        data: adminUpdateData,
      });
    }

    if (Object.keys(tgUpdateData).length > 0 && admin.telegramAccount) {
      await tx.telegramAccount.update({
        where: { id: admin.telegramAccount.id },
        data: tgUpdateData,
      });
    }

    await tx.auditLog.create({
      data: {
        action: "UPDATE_PROFILE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Admin",
        entityId: context.adminId,
        description: `[Hnia AI Telegram] Mise à jour profil administrateur : ${changes.join(", ")}`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "dashboard");

  return {
    success: true,
    message: `👤 <b>Profil Administrateur Mis à Jour</b>
━━━━━━━━━━━━━━━━━━━━━━
• ${changes.join("\n• ")}

<blockquote>💡 <b>Hnia :</b> Vos coordonnées et préférences ont été actualisées avec succès.</blockquote>`,
    summary: `Mise à jour profil ${context.adminName}`,
    data: { adminId: context.adminId, updates: { ...adminUpdateData, ...tgUpdateData } },
  };
}

/**
 * Tool: get_school_settings
 * Retrieves the school & institution parameters (/settings): name, address, phone, logo, academic year, semester, hours, tuition fees.
 */
export async function getSchoolSettingsTool(
  _args: Record<string, any>,
  context: ToolContext
) {
  const [institution, school, levels] = await Promise.all([
    prisma.institution.findFirst({
      where: { schoolId: context.schoolId },
    }),
    prisma.school.findUnique({
      where: { id: context.schoolId },
      select: { name: true, logo: true, subdomain: true, plan: true },
    }),
    prisma.level.findMany({
      where: { schoolId: context.schoolId },
      orderBy: { level: "asc" },
      select: { level: true, tuitionFee: true },
    }),
  ]);

  return {
    success: true,
    settings: {
      schoolName: institution?.schoolName || school?.name || "SnapSchool Academy",
      phone: institution?.phone || "Non configuré",
      address: institution?.address || "Non configurée",
      schoolLogo: institution?.schoolLogo || school?.logo || null,
      academicYear: institution?.academicYear || "2026-2027",
      currentSemester: institution?.currentSemester || 1,
      dayStartTime: institution?.dayStartTime || "08:00",
      dayEndTime: institution?.dayEndTime || "14:00",
      subdomain: school?.subdomain || null,
      plan: school?.plan || "FREE",
      tuitionFeesByLevel: levels.map((l) => ({
        level: l.level === 0 ? "Préparatoire" : `${l.level}ère/ème année`,
        fee: `${l.tuitionFee} DT/mois`,
      })),
    },
  };
}

/**
 * Tool: update_school_settings
 * Updates school & institution parameters (name, phone, address, logo, academic year, semester, hours).
 */
export async function updateSchoolSettingsTool(
  args: {
    schoolName?: string;
    phone?: string;
    address?: string;
    schoolLogo?: string;
    academicYear?: string;
    currentSemester?: number;
    dayStartTime?: string;
    dayEndTime?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  let institution = await prisma.institution.findFirst({
    where: { schoolId: context.schoolId },
  });

  if (!institution) {
    institution = await prisma.institution.create({
      data: {
        schoolId: context.schoolId,
        schoolName: "SnapSchool Academy",
        phone: "+216 71 000 000",
        address: "Tunis",
        academicYear: "2026-2027",
        currentSemester: 1,
        dayStartTime: "08:00",
        dayEndTime: "14:00",
      },
    });
  }

  const updateData: any = {};
  const schoolUpdateData: any = {};
  const changes: string[] = [];

  if (args.schoolName && args.schoolName.trim() !== institution.schoolName) {
    updateData.schoolName = args.schoolName.trim();
    schoolUpdateData.name = args.schoolName.trim();
    changes.push(`Nom de l'école : <b>${args.schoolName.trim()}</b>`);
  }

  if (args.phone && args.phone.trim() !== institution.phone) {
    updateData.phone = args.phone.trim();
    changes.push(`Téléphone officiel : <code>${args.phone.trim()}</code>`);
  }

  if (args.address && args.address.trim() !== institution.address) {
    updateData.address = args.address.trim();
    changes.push(`Adresse : <code>${args.address.trim()}</code>`);
  }

  if (args.schoolLogo !== undefined) {
    updateData.schoolLogo = args.schoolLogo || null;
    schoolUpdateData.logo = args.schoolLogo || null;
    changes.push(`Logo officiel mis à jour 🏫`);
  }

  if (args.academicYear && args.academicYear.trim() !== institution.academicYear) {
    updateData.academicYear = args.academicYear.trim();
    changes.push(`Année scolaire : <code>${args.academicYear.trim()}</code>`);
  }

  if (args.currentSemester && args.currentSemester !== institution.currentSemester) {
    updateData.currentSemester = args.currentSemester;
    changes.push(`Trimestre / Semestre en cours : <code>Trimestre ${args.currentSemester}</code>`);
  }

  if (args.dayStartTime && args.dayStartTime.trim() !== institution.dayStartTime) {
    updateData.dayStartTime = args.dayStartTime.trim();
    changes.push(`Heure d'ouverture : <code>${args.dayStartTime.trim()}</code>`);
  }

  if (args.dayEndTime && args.dayEndTime.trim() !== institution.dayEndTime) {
    updateData.dayEndTime = args.dayEndTime.trim();
    changes.push(`Heure de fermeture : <code>${args.dayEndTime.trim()}</code>`);
  }

  if (Object.keys(updateData).length === 0) {
    return {
      success: false,
      message: "Aucune modification spécifiée pour les paramètres de l'école.",
      summary: "Aucune modification",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.institution.update({
      where: { id: institution!.id },
      data: updateData,
    });

    if (Object.keys(schoolUpdateData).length > 0) {
      await tx.school.update({
        where: { id: context.schoolId },
        data: schoolUpdateData,
      });
    }

    await tx.auditLog.create({
      data: {
        action: "UPDATE_SETTINGS",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Institution",
        entityId: institution!.id.toString(),
        description: `[Hnia AI Telegram] Modification paramètres de l'école : ${changes.join(", ")}`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "institution", "dashboard");

  return {
    success: true,
    message: `⚙️ <b>Paramètres de l'Établissement Mis à Jour</b>
━━━━━━━━━━━━━━━━━━━━━━
• ${changes.join("\n• ")}

<blockquote>💡 <b>Hnia :</b> Les paramètres généraux de l'école ont été appliqués immédiatement.</blockquote>`,
    summary: `Mise à jour paramètres école`,
    data: { institutionId: institution.id, updates: updateData },
  };
}

/**
 * Tool: update_level_tuition_fee
 * Modifies the standard monthly tuition fee for an academic level.
 */
export async function updateLevelTuitionFeeTool(
  args: {
    levelNumber: number;
    tuitionFee: number;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const level = await prisma.level.findFirst({
    where: {
      schoolId: context.schoolId,
      level: args.levelNumber,
    },
  });

  if (!level) {
    return {
      success: false,
      message: `Niveau ${args.levelNumber} introuvable dans cette école.`,
      summary: `Niveau ${args.levelNumber} introuvable`,
    };
  }

  const oldFee = level.tuitionFee;
  const newFee = Math.abs(Number(args.tuitionFee));

  await prisma.$transaction(async (tx) => {
    await tx.level.update({
      where: { id: level.id },
      data: { tuitionFee: newFee },
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE_LEVEL_FEE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Level",
        entityId: level.id.toString(),
        description: `[Hnia AI Telegram] Modification frais de scolarité Niveau ${args.levelNumber} : ${oldFee} DT → ${newFee} DT/mois`,
        amount: newFee,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "finance", "students", "dashboard");

  const levelName = args.levelNumber === 0 ? "Préparatoire" : `${args.levelNumber}ème année`;

  return {
    success: true,
    message: `🎓 <b>Frais de Scolarité Mis à Jour</b>
━━━━━━━━━━━━━━━━━━━━━━
📚 <b>Niveau :</b> <b>${levelName}</b>
💰 <b>Tarif mensuel de base :</b> <code>${oldFee} DT</code> → <code>${newFee} DT/mois</code>

<blockquote>💡 <b>Hnia :</b> Le tarif standard a été mis à jour. Les nouveaux élèves inscrits dans ce niveau se verront appliquer ce montant.</blockquote>`,
    summary: `Tarif niveau ${args.levelNumber} fixé à ${newFee} DT`,
    data: { levelId: level.id, oldFee, newFee },
  };
}
