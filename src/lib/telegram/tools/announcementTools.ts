import prisma from "@/lib/prisma";
import { invalidateTenantTags } from "@/lib/cache";
import { createAnnouncementNotifications } from "@/lib/notifications";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import { resolveClassByName } from "./classResolver";

export interface AnnouncementItem {
  id: number;
  title: string;
  message: string;
  important: boolean;
  scope: string;
  className?: string | null;
  targetStudentName?: string | null;
  date: string;
  hasImages: boolean;
  imageUrls: string[];
  hasDocs: boolean;
  docUrls: string[];
}

/**
 * Tool: get_announcements
 * Fetches and filters official school announcements / notices.
 */
export async function getAnnouncementsTool(
  args: {
    className?: string;
    scope?: "all" | "global" | "class";
    importantOnly?: boolean;
    search?: string;
    limit?: number;
  },
  context: ToolContext
) {
  const limit = Math.min(args.limit || 10, 50);
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.importantOnly) {
    where.important = true;
  }

  if (args.search?.trim()) {
    const q = args.search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { message: { contains: q, mode: "insensitive" } },
    ];
  }

  // Handle class or global scope filtering
  if (args.className?.trim()) {
    const rawClass = args.className.trim().toLowerCase();
    if (
      rawClass === "all" ||
      rawClass === "toutes" ||
      rawClass === "general" ||
      rawClass === "général" ||
      rawClass === "global"
    ) {
      where.classId = null;
    } else {
      const cls = await resolveClassByName(context.schoolId, args.className);
      if (cls) {
        where.classId = cls.id;
      }
    }
  } else if (args.scope === "global") {
    where.classId = null;
  } else if (args.scope === "class") {
    where.classId = { not: null };
  }

  const [notices, totalCount, urgentCount] = await Promise.all([
    prisma.notice.findMany({
      where,
      include: {
        class: true,
        targetStudent: { select: { name: true, surname: true } },
      },
      orderBy: { date: "desc" },
      take: limit,
    }),
    prisma.notice.count({ where: { schoolId: context.schoolId } }),
    prisma.notice.count({ where: { schoolId: context.schoolId, important: true } }),
  ]);

  if (notices.length === 0) {
    const filterDesc = args.className
      ? ` pour la classe ${args.className}`
      : args.importantOnly
      ? " urgentes"
      : args.search
      ? ` contenant "${args.search}"`
      : "";
    return {
      found: false,
      message: `Aucune annonce trouvée${filterDesc}.`,
      totalCount,
      urgentCount,
      announcements: [],
    };
  }

  const announcements: AnnouncementItem[] = notices.map((n) => {
    const createdDate = new Date(n.date);
    const formattedDate = createdDate.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    let scopeLabel = "Général (Toute l'école)";
    if (n.targetStudent) {
      scopeLabel = `Élève : ${n.targetStudent.name} ${n.targetStudent.surname}`;
    } else if (n.class) {
      scopeLabel = `Classe ${n.class.name}`;
    }

    const imgs = n.img ? n.img.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const docs = n.pdfUrl ? n.pdfUrl.split(",").map((s) => s.trim()).filter(Boolean) : [];

    return {
      id: n.id,
      title: n.title,
      message: n.message,
      important: n.important,
      scope: scopeLabel,
      className: n.class?.name || null,
      targetStudentName: n.targetStudent ? `${n.targetStudent.name} ${n.targetStudent.surname}` : null,
      date: formattedDate,
      hasImages: imgs.length > 0,
      imageUrls: imgs,
      hasDocs: docs.length > 0,
      docUrls: docs,
    };
  });

  return {
    found: true,
    totalCount,
    urgentCount,
    displayedCount: announcements.length,
    announcements,
  };
}

/**
 * Tool: post_announcement (ou create_announcement)
 * Publishes an official announcement for the school, a specific class, or a student.
 */
export async function postAnnouncementTool(
  args: {
    title: string;
    message: string;
    className?: string;
    important?: boolean;
    img?: string;
    pdfUrl?: string;
    studentName?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  let targetClassId: number | null = null;
  let targetClassName: string | null = null;
  let targetStudentId: string | null = null;
  let targetStudentDisplayName: string | null = null;

  // Resolve target class if specified
  if (args.className?.trim()) {
    const raw = args.className.trim().toLowerCase();
    const isGlobal =
      raw === "all" ||
      raw === "toutes" ||
      raw === "tout le monde" ||
      raw === "general" ||
      raw === "général" ||
      raw === "global" ||
      raw === "toute l'école" ||
      raw === "ecole";

    if (!isGlobal) {
      const cls = await resolveClassByName(context.schoolId, args.className);
      if (cls) {
        targetClassId = cls.id;
        targetClassName = cls.name;
      }
    }
  }

  // Resolve target student if specified
  if (args.studentName?.trim()) {
    const cleanName = args.studentName.trim();
    const foundStudent = await prisma.student.findFirst({
      where: {
        schoolId: context.schoolId,
        OR: [
          { name: { contains: cleanName, mode: "insensitive" } },
          { surname: { contains: cleanName, mode: "insensitive" } },
        ],
      },
      include: { class: true },
    });
    if (foundStudent) {
      targetStudentId = foundStudent.id;
      targetStudentDisplayName = `${foundStudent.name} ${foundStudent.surname}`;
      if (!targetClassId && foundStudent.classId) {
        targetClassId = foundStudent.classId;
        targetClassName = foundStudent.class?.name || null;
      }
    }
  }

  const isUrgent = Boolean(args.important);
  const cleanTitle = args.title.trim();
  const cleanMessage = args.message.trim();
  const cleanImg = args.img?.trim() || null;
  const cleanPdf = args.pdfUrl?.trim() || null;

  // Transaction: Create Notice + Audit Log
  const notice = await prisma.$transaction(async (tx) => {
    const created = await tx.notice.create({
      data: {
        title: cleanTitle,
        message: cleanMessage,
        important: isUrgent,
        classId: targetClassId,
        targetStudentId: targetStudentId,
        img: cleanImg,
        pdfUrl: cleanPdf,
        schoolId: context.schoolId,
      },
      include: {
        class: true,
        targetStudent: true,
      },
    });

    const targetDesc = targetStudentDisplayName
      ? `Élève ${targetStudentDisplayName}`
      : targetClassName
      ? `Classe ${targetClassName}`
      : "Général (Toute l'école)";

    await tx.auditLog.create({
      data: {
        action: "POST_NOTICE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Notice",
        entityId: created.id.toString(),
        description: `[Hnia AI Telegram] Publication d'annonce : "${cleanTitle}" [Portée : ${targetDesc}]${isUrgent ? " [URGENT]" : ""}`,
        schoolId: context.schoolId,
      },
    });

    return created;
  });

  // Push notifications to parents (asynchronous broadcast)
  try {
    await createAnnouncementNotifications(notice.id);
  } catch (err) {
    console.warn("[postAnnouncementTool] Push notification warning:", err);
  }

  invalidateTenantTags(context.schoolId, "institution", "dashboard");

  // Format confirmation response
  const targetBadge = targetStudentDisplayName
    ? `👤 Élève <b>${targetStudentDisplayName}</b>`
    : targetClassName
    ? `👥 Classe <code>${targetClassName}</code>`
    : `🌐 <b>Général (Toute l'école)</b>`;

  const urgentBadge = isUrgent ? ` • 🚨 <code>URGENT</code>` : "";
  const imgCount = cleanImg ? cleanImg.split(",").filter(Boolean).length : 0;
  const docCount = cleanPdf ? cleanPdf.split(",").filter(Boolean).length : 0;
  const attachments = [
    imgCount > 0 ? `🖼️ <code>${imgCount} image(s)</code>` : null,
    docCount > 0 ? `📄 <code>${docCount} document(s)</code>` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const previewSnippet =
    cleanMessage.length > 200 ? `${cleanMessage.slice(0, 197)}...` : cleanMessage;

  const confirmationMessage = [
    `📢 <b>Annonce Publiée avec Succès !</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>${notice.title}</b>`,
    `🎯 <b>Portée :</b> ${targetBadge}${urgentBadge}`,
    attachments ? `📎 <b>Pièces jointes :</b> ${attachments}` : null,
    `📝 <i>"${previewSnippet}"</i>`,
    ``,
    `📱 <i>Notification push transmise instantanément aux familles concernées.</i>`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    success: true,
    message: confirmationMessage,
    summary: `Annonce "${notice.title}" (${targetClassName || "Toute l'école"})`,
    data: { noticeId: notice.id },
  };
}

/**
 * Tool: delete_announcement
 * Deletes an announcement by ID or by title matching.
 */
export async function deleteAnnouncementTool(
  args: {
    announcementId?: number;
    title?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  let noticeToDelete: any = null;

  if (args.announcementId) {
    noticeToDelete = await prisma.notice.findFirst({
      where: {
        id: args.announcementId,
        schoolId: context.schoolId,
      },
      include: { class: true },
    });
  } else if (args.title?.trim()) {
    const q = args.title.trim();
    noticeToDelete = await prisma.notice.findFirst({
      where: {
        schoolId: context.schoolId,
        title: { contains: q, mode: "insensitive" },
      },
      orderBy: { date: "desc" },
      include: { class: true },
    });
  }

  if (!noticeToDelete) {
    return {
      success: false,
      message: `Annonce introuvable${args.title ? ` avec le titre "${args.title}"` : ""}.`,
      summary: "Annonce introuvable",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.notice.delete({
      where: { id: noticeToDelete.id },
    });

    await tx.auditLog.create({
      data: {
        action: "DELETE_NOTICE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Notice",
        entityId: noticeToDelete.id.toString(),
        description: `[Hnia AI Telegram] Suppression de l'annonce : "${noticeToDelete.title}"`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "institution", "dashboard");

  return {
    success: true,
    message: `🗑️ L'annonce <b>"${noticeToDelete.title}"</b> a été supprimée avec succès.`,
    summary: `Annonce "${noticeToDelete.title}" supprimée`,
    data: { deletedId: noticeToDelete.id },
  };
}
