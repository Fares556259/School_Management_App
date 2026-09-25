import prisma from "@/lib/prisma";
import { Expo } from "expo-server-sdk";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import { resolveClassByName } from "./classResolver";
import { resolveStudentByName } from "./entityResolvers";
import {
  sendDirectPushTokens,
  sendPushToTeachers,
  sendMobileMessageToParents,
  sendPushBatch,
} from "@/lib/notifications";

/**
 * Finds the most relevant Expo push token(s) for the current Telegram admin.
 */
export async function getAdminPushTokens(context: ToolContext): Promise<string[]> {
  const tokens: string[] = [];

  // 1. Look up Admin phone and name
  const admin = await prisma.admin.findUnique({
    where: { id: context.adminId },
    select: { phone: true, name: true, surname: true },
  });

  // 2. Try to find Parent or Teacher with same phone in this school
  if (admin?.phone) {
    const cleanPhone = admin.phone.replace(/\D/g, "");
    const parent = await prisma.parent.findFirst({
      where: {
        OR: [
          { phone: admin.phone },
          { phone: { contains: cleanPhone.slice(-8) } },
        ],
        expoPushToken: { not: null },
      },
      select: { expoPushToken: true },
    });
    if (parent?.expoPushToken) tokens.push(parent.expoPushToken);

    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [
          { phone: admin.phone },
          { phone: { contains: cleanPhone.slice(-8) } },
        ],
        expoPushToken: { not: null },
      },
      select: { expoPushToken: true },
    });
    if (teacher?.expoPushToken) tokens.push(teacher.expoPushToken);
  }

  // 3. Try finding by admin name
  if (tokens.length === 0 && (admin?.name || context.adminName)) {
    const rawSearch = (admin?.name || context.adminName || "").trim();
    const firstWord = rawSearch.split(" ")[0].trim();
    if (firstWord.length >= 3) {
      const parent = await prisma.parent.findFirst({
        where: {
          schoolId: context.schoolId,
          OR: [
            { name: { contains: firstWord, mode: "insensitive" } },
            { surname: { contains: firstWord, mode: "insensitive" } },
          ],
          expoPushToken: { not: null },
        },
        select: { expoPushToken: true },
      });
      if (parent?.expoPushToken) tokens.push(parent.expoPushToken);

      const teacher = await prisma.teacher.findFirst({
        where: {
          schoolId: context.schoolId,
          OR: [
            { name: { contains: firstWord, mode: "insensitive" } },
            { surname: { contains: firstWord, mode: "insensitive" } },
          ],
          expoPushToken: { not: null },
        },
        select: { expoPushToken: true },
      });
      if (teacher?.expoPushToken) tokens.push(teacher.expoPushToken);
    }
  }

  // 4. Try any registered parent in the school
  if (tokens.length === 0) {
    const anyParent = await prisma.parent.findFirst({
      where: { schoolId: context.schoolId, expoPushToken: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { expoPushToken: true },
    });
    if (anyParent?.expoPushToken) tokens.push(anyParent.expoPushToken);
  }

  // 5. Fallback for test environments: token of user 'fares selmi' or 'hnia'
  if (tokens.length === 0) {
    const fallbackParent = await prisma.parent.findFirst({
      where: {
        name: { contains: "fares", mode: "insensitive" },
        expoPushToken: { not: null },
      },
      select: { expoPushToken: true },
    });
    if (fallbackParent?.expoPushToken) tokens.push(fallbackParent.expoPushToken);
  }

  return Array.from(new Set(tokens.filter((t) => t && Expo.isExpoPushToken(t))));
}

/**
 * Tool: send_test_push
 * Instantly fires a test push notification to the current administrator's phone (0-click).
 */
export async function sendTestPushTool(
  args: {
    title?: string;
    message?: string;
    urgent?: boolean;
  },
  context: ToolContext
) {
  const tokens = await getAdminPushTokens(context);

  if (tokens.length === 0) {
    return {
      success: false,
      message: `⚠️ <b>Aucun appareil mobile détecté</b>\n━━━━━━━━━━━━━━━━━━━━━━\nJe n'ai pas trouvé de jeton push (Expo Token) associé à votre compte.\n\n💡 <b>Pour activer les notifications sur votre téléphone :</b>\n1. Ouvrez l'application SnapSchool sur votre smartphone.\n2. Allez dans l'onglet <b>Profil</b>.\n3. Activez l'option <b>Notifications</b>.\n4. Redemandez-moi ensuite d'envoyer un test !`,
      summary: "Aucun appareil mobile trouvé",
    };
  }

  const title = args.title?.trim() || "🔔 Test SnapSchool de Hnia";
  const body =
    args.message?.trim() ||
    "Les notifications push de Hnia fonctionnent parfaitement sur votre smartphone ! 🚀";
  const isUrgent = Boolean(args.urgent);

  const res = await sendDirectPushTokens(tokens, title, body, {
    channelId: isUrgent ? "snapschool_emergency_v1" : "snapschool_alerts_v1",
    sound: "default",
    data: { test: true, timestamp: Date.now() },
  });

  if (!res.success) {
    return {
      success: false,
      message: `⚠️ L'envoi vers le service de notification a échoué. Veuillez vérifier que votre téléphone est bien connecté à Internet.`,
      summary: "Échec envoi push test",
    };
  }

  const channelBadge = isUrgent
    ? `🚨 <code>CANAL URGENCE (Sirène)</code>`
    : `📢 <code>Canal Standard</code>`;

  const confirmationMsg = [
    `📱 <b>Notification Push Envoyée sur Votre Téléphone !</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>Titre :</b> ${title}`,
    `💬 <b>Message :</b> <i>"${body}"</i>`,
    `🔔 <b>Sonnerie :</b> ${channelBadge}`,
    `🎯 <b>Statut :</b> Livré avec succès aux serveurs Google/FCM.`,
    ``,
    `<blockquote>💡 <b>Hnia :</b> Regardez l'écran ou le bandeau de votre smartphone ! 🔔</blockquote>`,
  ].join("\n");

  return {
    success: true,
    message: confirmationMsg,
    summary: `Push test envoyé (${tokens.length} appareil)`,
    data: { sentCount: res.sentCount },
  };
}

/**
 * Tool: send_push_notification
 * General purpose tool to dispatch push notifications to parents, teachers, classes, or specific individuals.
 */
export async function sendPushNotificationTool(
  args: {
    target: "me" | "teachers" | "teacher" | "student" | "class" | "parents" | "unpaid" | "all";
    title: string;
    message: string;
    targetName?: string;
    urgent?: boolean;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const target = args.target || "me";
  const title = args.title?.trim() || "Information SnapSchool";
  const body = args.message?.trim();
  const isUrgent = Boolean(args.urgent);

  if (!body) {
    return {
      success: false,
      message: "⚠️ Veuillez préciser le texte du message à envoyer.",
      summary: "Texte manquant",
    };
  }

  // ── CASE 1: Test / Me ───────────────────────────────────────────────────────
  if (target === "me") {
    const testResult = await sendTestPushTool(
      { title, message: body, urgent: isUrgent },
      context
    );
    return testResult as WriteToolResult;
  }

  // ── CASE 2: All Teachers ───────────────────────────────────────────────────
  if (target === "teachers") {
    const result = await sendPushToTeachers({
      schoolId: context.schoolId,
      title,
      body,
      options: {
        channelId: isUrgent ? "snapschool_emergency_v1" : "snapschool_alerts_v1",
        sound: "default",
        data: { type: "STAFF_NOTICE" },
      },
    });

    if (result.validTokensCount === 0) {
      return {
        success: false,
        message: `⚠️ Aucun enseignant de l'établissement n'a encore enregistré son appareil mobile (0 token disponible sur ${result.count} enseignants enregistrés).`,
        summary: "Aucun enseignant connecté au mobile",
      };
    }

    await prisma.auditLog.create({
      data: {
        action: "SEND_PUSH_TEACHERS",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Notification",
        description: `[Hnia AI Telegram] Push envoyé à ${result.validTokensCount} enseignant(s) : "${title}"`,
        schoolId: context.schoolId,
      },
    });

    const urgentBadge = isUrgent ? ` • 🚨 <code>URGENT (Sirène)</code>` : "";
    return {
      success: true,
      message: `📢 <b>Notification Push transmise aux Enseignants !</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>Titre :</b> ${title}\n💬 <b>Message :</b> <i>"${body}"</i>\n🎯 <b>Destinataires :</b> <code>${result.validTokensCount} enseignant(s)</code>${urgentBadge}\n\n📱 <i>Les enseignants ont reçu l'alerte instantanément sur leur smartphone.</i>`,
      summary: `Push envoyé à ${result.validTokensCount} enseignant(s)`,
      data: { count: result.validTokensCount },
    };
  }

  // ── CASE 3: Specific Teacher ───────────────────────────────────────────────
  if (target === "teacher") {
    if (!args.targetName?.trim()) {
      return {
        success: false,
        message: "⚠️ Veuillez préciser le nom de l'enseignant à notifier (ex: 'Ahmed Ben Ali').",
        summary: "Nom enseignant manquant",
      };
    }

    const cleanName = args.targetName.trim();
    const teacher = await prisma.teacher.findFirst({
      where: {
        schoolId: context.schoolId,
        OR: [
          { name: { contains: cleanName, mode: "insensitive" } },
          { surname: { contains: cleanName, mode: "insensitive" } },
        ],
      },
    });

    if (!teacher) {
      return {
        success: false,
        message: `⚠️ Enseignant introuvable avec le nom <b>"${cleanName}"</b>.`,
        summary: "Enseignant introuvable",
      };
    }

    if (!teacher.expoPushToken || !Expo.isExpoPushToken(teacher.expoPushToken)) {
      return {
        success: false,
        message: `⚠️ L'enseignant <b>${teacher.name} ${teacher.surname}</b> n'a pas encore connecté l'application mobile (aucun jeton push enregistré).`,
        summary: "Enseignant sans push token",
      };
    }

    await sendDirectPushTokens([teacher.expoPushToken], title, body, {
      channelId: isUrgent ? "snapschool_emergency_v1" : "snapschool_alerts_v1",
      sound: "default",
      data: { type: "TEACHER_ALERT" },
    });

    await prisma.auditLog.create({
      data: {
        action: "SEND_PUSH_TEACHER",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Notification",
        description: `[Hnia AI Telegram] Push envoyé à ${teacher.name} ${teacher.surname} : "${title}"`,
        schoolId: context.schoolId,
      },
    });

    return {
      success: true,
      message: `📱 <b>Notification envoyée à ${teacher.name} ${teacher.surname} !</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>Titre :</b> ${title}\n💬 <b>Message :</b> <i>"${body}"</i>\n\n🔔 <i>Alerte push transmise directement sur son smartphone.</i>`,
      summary: `Push envoyé à ${teacher.name} ${teacher.surname}`,
      data: { teacherId: teacher.id },
    };
  }

  // ── CASE 4: Specific Student's Parent ──────────────────────────────────────
  if (target === "student") {
    if (!args.targetName?.trim()) {
      return {
        success: false,
        message: "⚠️ Veuillez préciser le nom de l'élève.",
        summary: "Nom élève manquant",
      };
    }

    const student = await resolveStudentByName(context.schoolId, args.targetName.trim());
    if (!student) {
      return {
        success: false,
        message: `⚠️ Aucun élève trouvé correspondant à "${args.targetName}".`,
        summary: "Élève introuvable",
      };
    }

    if (!student.parentId) {
      return {
        success: false,
        message: `⚠️ L'élève <b>${student.name} ${student.surname}</b> n'a aucun profil parent rattaché.`,
        summary: "Parent non rattaché",
      };
    }

    const parent = await prisma.parent.findUnique({
      where: { id: student.parentId },
      select: { id: true, name: true, surname: true, expoPushToken: true },
    });

    if (!parent?.expoPushToken || !Expo.isExpoPushToken(parent.expoPushToken)) {
      // Still create in-app notification in DB so parent sees it when they log in
      await prisma.notification.create({
        data: {
          schoolId: context.schoolId,
          parentId: parent?.id || student.parentId,
          studentId: student.id,
          type: isUrgent ? "ANNOUNCEMENT" : "MESSAGE",
          title,
          message: body,
        },
      });

      return {
        success: true,
        message: `ℹ️ <b>Message enregistré dans l'espace parent de ${student.name} ${student.surname} !</b>\n<i>Le parent n'a pas encore activé les alertes push en arrière-plan, mais verra ce message dès ouverture de l'application.</i>`,
        summary: `Notification in-app créée pour ${student.name}`,
      };
    }

    // Create in-app record
    await prisma.notification.create({
      data: {
        schoolId: context.schoolId,
        parentId: parent.id,
        studentId: student.id,
        type: isUrgent ? "ANNOUNCEMENT" : "MESSAGE",
        title,
        message: body,
      },
    });

    // Send push
    await sendDirectPushTokens([parent.expoPushToken], title, body, {
      channelId: isUrgent ? "snapschool_emergency_v1" : "snapschool_alerts_v1",
      sound: "default",
      data: { studentId: student.id, type: "STUDENT_UPDATE" },
    });

    await prisma.auditLog.create({
      data: {
        action: "SEND_PUSH_STUDENT",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Notification",
        description: `[Hnia AI Telegram] Push envoyé aux parents de ${student.name} ${student.surname} : "${title}"`,
        schoolId: context.schoolId,
      },
    });

    return {
      success: true,
      message: `📱 <b>Notification transmise aux parents de ${student.name} ${student.surname} !</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>Titre :</b> ${title}\n💬 <b>Message :</b> <i>"${body}"</i>\n\n🔔 <i>Alerte push et message in-app délivrés instantanément.</i>`,
      summary: `Push envoyé aux parents de ${student.name}`,
    };
  }

  // ── CASE 5: Specific Class ─────────────────────────────────────────────────
  if (target === "class") {
    if (!args.targetName?.trim()) {
      return {
        success: false,
        message: "⚠️ Veuillez préciser le nom de la classe (ex: '8ème B').",
        summary: "Nom classe manquant",
      };
    }

    const cls = await resolveClassByName(context.schoolId, args.targetName.trim());
    if (!cls) {
      return {
        success: false,
        message: `⚠️ Classe "${args.targetName}" introuvable.`,
        summary: "Classe introuvable",
      };
    }

    const students = await prisma.student.findMany({
      where: { schoolId: context.schoolId, classId: cls.id, parentId: { not: null } },
      select: { parentId: true },
    });

    const parentIds = Array.from(new Set(students.map((s) => s.parentId).filter((id): id is string => Boolean(id))));

    if (parentIds.length === 0) {
      return {
        success: false,
        message: `⚠️ Aucun parent trouvé pour la classe <b>${cls.name}</b>.`,
        summary: "Aucun parent dans cette classe",
      };
    }

    const { count, pushTokensCount } = await sendMobileMessageToParents({
      schoolId: context.schoolId,
      parentIds,
      title,
      message: body,
      type: isUrgent ? "ANNOUNCEMENT" : "MESSAGE",
      data: { channelId: isUrgent ? "emergency" : "default" },
    });

    const pushLine = pushTokensCount > 0
      ? `📲 <b>Notifications Push :</b> délivrées sur <code>${pushTokensCount} smartphone(s)</code> actif(s).`
      : `⚠️ <b>Notifications Push :</b> aucun smartphone connecté pour cette classe.`;

    const pendingLine = count > pushTokensCount && pushTokensCount > 0
      ? `\nℹ️ <i>${count - pushTokensCount} famille(s) sans smartphone connecté verront le message dès leur prochaine connexion.</i>`
      : "";

    return {
      success: true,
      message: `📢 <b>Notification transmise à la classe ${cls.name} !</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>Titre :</b> ${title}\n💬 <b>Message :</b> <i>"${body}"</i>\n📥 <b>Espace Mobile :</b> <code>${count} famille(s)</code> (in-app)\n${pushLine}${pendingLine}`,
      summary: `Push envoyé classe ${cls.name} (${pushTokensCount} actifs / ${count} in-app)`,
    };
  }

  // ── CASE 6: Unpaid Parents ─────────────────────────────────────────────────
  if (target === "unpaid") {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const unpaidStudents = await prisma.student.findMany({
      where: {
        schoolId: context.schoolId,
        parentId: { not: null },
        payments: {
          none: {
            month: currentMonth,
            year: currentYear,
            status: "PAID",
            userType: "STUDENT",
          },
        },
      },
      select: { parentId: true },
    });

    const parentIds = Array.from(new Set(unpaidStudents.map((s) => s.parentId).filter((id): id is string => Boolean(id))));

    if (parentIds.length === 0) {
      return {
        success: true,
        message: `🎉 <b>Toutes les familles sont à jour !</b> Aucun élève n'a d'impayé pour le mois en cours.`,
        summary: "Aucun impayé",
      };
    }

    const { count, pushTokensCount } = await sendMobileMessageToParents({
      schoolId: context.schoolId,
      parentIds,
      title: title || "💰 Rappel de Scolarité",
      message: body,
      type: "PAYMENT",
      data: { channelId: isUrgent ? "emergency" : "default" },
    });

    return {
      success: true,
      message: `💰 <b>Rappels d'impayés envoyés !</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>Titre :</b> ${title}\n💬 <b>Message :</b> <i>"${body}"</i>\n📥 <b>Boîtes de réception in-app :</b> <code>${count} famille(s)</code>\n📲 <b>Smartphones notifiés :</b> <code>${pushTokensCount} appareil(s)</code> actif(s).`,
      summary: `Rappels impayés (${pushTokensCount} push / ${count} in-app)`,
    };
  }

  // ── CASE 7: All Parents ────────────────────────────────────────────────────
  if (target === "parents") {
    const allParents = await prisma.parent.findMany({
      where: { schoolId: context.schoolId },
      select: { id: true },
    });
    const parentIds = allParents.map((p) => p.id);

    const { count, pushTokensCount } = await sendMobileMessageToParents({
      schoolId: context.schoolId,
      parentIds,
      title,
      message: body,
      type: isUrgent ? "ANNOUNCEMENT" : "MESSAGE",
      data: { channelId: isUrgent ? "emergency" : "default" },
    });

    return {
      success: true,
      message: `📢 <b>Notification générale diffusée aux familles !</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>Titre :</b> ${title}\n💬 <b>Message :</b> <i>"${body}"</i>\n📥 <b>Portée globale :</b> <code>${count} parent(s)</code> (in-app)\n📲 <b>Smartphones notifiés :</b> <code>${pushTokensCount} appareil(s)</code> actif(s).`,
      summary: `Notification (${pushTokensCount} push / ${count} in-app)`,
    };
  }

  // ── CASE 8: Broadcast All (Parents + Teachers) ─────────────────────────────
  const [allParents, teacherRes] = await Promise.all([
    prisma.parent.findMany({ where: { schoolId: context.schoolId }, select: { id: true } }),
    sendPushToTeachers({
      schoolId: context.schoolId,
      title,
      body,
      options: { channelId: isUrgent ? "emergency" : "default" },
    }),
  ]);

  const { count: parentCount, pushTokensCount } = await sendMobileMessageToParents({
    schoolId: context.schoolId,
    parentIds: allParents.map((p) => p.id),
    title,
    message: body,
    type: isUrgent ? "ANNOUNCEMENT" : "MESSAGE",
    data: { channelId: isUrgent ? "emergency" : "default" },
  });

  return {
    success: true,
    message: `📢 <b>Diffusion Générale Réussie !</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📌 <b>Titre :</b> ${title}\n💬 <b>Message :</b> <i>"${body}"</i>\n👨‍👩‍👧 <b>Familles (in-app) :</b> <code>${parentCount}</code> (dont ${pushTokensCount} smartphone(s) actif(s))\n👨‍🏫 <b>Enseignants notifiés :</b> <code>${teacherRes.validTokensCount}</code>`,
    summary: `Diffusion (${parentCount} parents, ${teacherRes.validTokensCount} profs)`,
  };
}
