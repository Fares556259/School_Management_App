import prisma from "./prisma";
import { Expo } from "expo-server-sdk";
import {
  expandStoredExpoPushDevices,
  parseStoredExpoPushDevices,
  type ExpoPushDevice,
} from "./expoPushTokens";

const expo = new Expo();

/**
 * Canonical notification channel resolver.
 * Ensures notifications are routed to Android Notification Channels configured with MAX importance and system ringtones.
 */
type PushChannelId =
  | 'default'
  | 'emergency'
  | 'snapschool_alerts_v1'
  | 'snapschool_emergency_v1'
  | 'snapschool_alerts_v2'
  | 'snapschool_emergency_v2'
  | 'snapschool_alerts_v3'
  | 'snapschool_emergency_v3';

function isEmergencyChannel(rawChannel?: string): boolean {
  return (
    rawChannel === 'emergency' ||
    rawChannel === 'snapschool_emergency_v1' ||
    rawChannel === 'snapschool_emergency_v2' ||
    rawChannel === 'snapschool_emergency_v3'
  );
}

export function resolveChannelId(
  rawChannel?: string,
  channelVersion = 2
): 'snapschool_emergency_v2' | 'snapschool_alerts_v2' | 'snapschool_emergency_v3' | 'snapschool_alerts_v3' {
  const emergency = isEmergencyChannel(rawChannel);
  if (channelVersion >= 3) return emergency ? 'snapschool_emergency_v3' : 'snapschool_alerts_v3';
  return emergency ? 'snapschool_emergency_v2' : 'snapschool_alerts_v2';
}

function resolveSound(
  device: ExpoPushDevice,
  channelId: ReturnType<typeof resolveChannelId>,
  requestedSound?: string
) {
  if (requestedSound === 'none') return null;
  if (requestedSound && requestedSound !== 'default') return requestedSound;
  // Android 8+ uses the channel sound. iOS keeps the reliable system sound
  // until the bundled files are replaced with native WAV/CAF assets.
  if (device.platform === 'android' && channelId === 'snapschool_emergency_v3') return 'alert.m4a';
  if (device.platform === 'android' && channelId === 'snapschool_alerts_v3') return 'notification.m4a';
  return 'default';
}

function buildPushMessage(
  device: ExpoPushDevice,
  title: string,
  body: string,
  data: any,
  rawChannel?: string,
  requestedSound?: string,
  priority: 'default' | 'normal' | 'high' = 'high'
) {
  const channelId = resolveChannelId(rawChannel, device.channelVersion);
  return {
    to: device.token,
    sound: resolveSound(device, channelId, requestedSound) as any,
    title,
    body,
    data: { ...data, channelId, title, body, message: body },
    channelId,
    priority,
  };
}

/**
 * Sends a push notification to a parent via Expo.
 */
export async function sendPush(parentId: string, title: string, body: string, data: any = {}) {
  try {
    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      select: { expoPushToken: true },
    });

    const devices = parseStoredExpoPushDevices(parent?.expoPushToken);
    if (devices.length === 0) return;

    const result = await sendDirectPushTokens([parent!.expoPushToken!], title, body, {
      channelId: data.channelId,
      data,
    });
    console.log(`[PUSH-SENT] To parent ${parentId}: ${result.sentCount}/${devices.length} devices`);
  } catch (error) {
    console.error("[PUSH-ERROR]", error);
  }
}

/**
 * Sends push notifications to multiple parents in a single batch.
 * Fetches all tokens in one query and uses Expo's batch API.
 */
export async function sendPushBatch(
  parentIds: string[],
  title: string,
  body: string,
  data: any = {}
): Promise<{ totalParents: number; tokensCount: number; sentCount: number }> {
  if (parentIds.length === 0) return { totalParents: 0, tokensCount: 0, sentCount: 0 };
  try {
    console.log(`[PUSH-BATCH-START] title="${title}", parentIds=${parentIds.length}`);
    const parents = await prisma.parent.findMany({
      where: { id: { in: parentIds } },
      select: { id: true, expoPushToken: true, phone: true },
    });

    const devicesByParent = new Map(
      parents.map((parent) => [parent.id, parseStoredExpoPushDevices(parent.expoPushToken)])
    );
    const parentsWithTokens = parents.filter((parent) => (devicesByParent.get(parent.id)?.length || 0) > 0);
    console.log(`[PUSH-BATCH] Found ${parents.length} parents, ${parentsWithTokens.length} with registered devices`);

    // Fallback: If some parents have null tokens, check if any account with the same phone has an active push token
    const missingParents = parents.filter(
      (parent) => (devicesByParent.get(parent.id)?.length || 0) === 0 && parent.phone
    );

    if (missingParents.length > 0) {
      const phones = Array.from(new Set(missingParents.map((p) => p.phone).filter(Boolean)));
      try {
        const [altParents, altTeachers] = await Promise.all([
          prisma.parent.findMany({
            where: { phone: { in: phones }, expoPushToken: { not: null } },
            select: { id: true, phone: true, expoPushToken: true },
          }),
          prisma.teacher.findMany({
            where: { phone: { in: phones }, expoPushToken: { not: null } },
            select: { id: true, phone: true, expoPushToken: true },
          }),
        ]);

        const phoneToDevices = new Map<string, ExpoPushDevice[]>();
        for (const p of altParents) {
          const devices = parseStoredExpoPushDevices(p.expoPushToken);
          if (devices.length > 0) phoneToDevices.set(p.phone, devices);
        }
        for (const t of altTeachers) {
          const devices = parseStoredExpoPushDevices(t.expoPushToken);
          if (t.phone && devices.length > 0 && !phoneToDevices.has(t.phone)) {
            phoneToDevices.set(t.phone, devices);
          }
        }

        for (const p of missingParents) {
          if (p.phone && phoneToDevices.has(p.phone)) devicesByParent.set(p.id, phoneToDevices.get(p.phone)!);
        }
        console.log(`[PUSH-BATCH] Phone fallback matched ${missingParents.filter((p) => (devicesByParent.get(p.id)?.length || 0) > 0).length} parents`);
      } catch (fbErr) {
        console.warn("[PUSH-FALLBACK-LOOKUP-WARN]", fbErr);
      }
    }

    const uniqueDevices = new Map<string, ExpoPushDevice>();
    for (const parent of parents) {
      for (const device of devicesByParent.get(parent.id) || []) uniqueDevices.set(device.token, device);
    }
    if (uniqueDevices.size === 0) {
      console.log(`[PUSH-BATCH] No valid tokens found, skipping push`);
      return { totalParents: parents.length, tokensCount: 0, sentCount: 0 };
    }

    // Deduplicate tokens to avoid sending the same push multiple times to the same device
    const uniqueMessages = Array.from(uniqueDevices.values()).map((device) =>
      buildPushMessage(device, title, body, data, data.channelId)
    );

    console.log(`[PUSH-BATCH] Sending ${uniqueMessages.length} unique push(es) via direct HTTP to Expo API`);

    // Use direct HTTP fetch to Expo Push API instead of SDK for reliability on serverless
    let sentCount = 0;
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(uniqueMessages),
      });
      const result = await response.json();
      console.log(`[PUSH-BATCH] Expo API response:`, JSON.stringify(result));

      if (result.data) {
        const tickets = Array.isArray(result.data) ? result.data : [result.data];
        for (const t of tickets) {
          if (t.status === 'ok') {
            sentCount++;
          } else {
            console.error('[PUSH-BATCH-TICKET-ERROR]', t.message, t.details);
          }
        }
      }
    } catch (fetchErr) {
      console.error('[PUSH-BATCH-FETCH-ERROR] Direct HTTP to Expo failed:', fetchErr);
      // Fallback to Expo SDK if direct HTTP fails
      try {
        console.log('[PUSH-BATCH] Falling back to Expo SDK...');
        const chunks = expo.chunkPushNotifications(uniqueMessages);
        for (const chunk of chunks) {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          for (const t of tickets) {
            if (t.status === 'ok') sentCount++;
            else console.error('[PUSH-BATCH-TICKET-ERROR]', t.message, (t as any).details);
          }
        }
      } catch (sdkErr) {
        console.error('[PUSH-BATCH-SDK-ERROR]', sdkErr);
      }
    }

    console.log(`[PUSH-BATCH] Sent ${sentCount}/${uniqueMessages.length} notifications: ${title}`);
    return { totalParents: parents.length, tokensCount: uniqueDevices.size, sentCount };
  } catch (error) {
    console.error("[PUSH-BATCH-ERROR]", error);
    return { totalParents: parentIds.length, tokensCount: 0, sentCount: 0 };
  }
}

/**
 * Sends individualized push notifications to multiple parents in batch.
 */
async function sendPushIndividualBatch(
  items: { parentId: string; title: string; body: string; data?: any }[]
) {
  if (items.length === 0) return;
  try {
    const parentIds = Array.from(new Set(items.map((i) => i.parentId)));
    const parents = await prisma.parent.findMany({
      where: { id: { in: parentIds } },
      select: { id: true, expoPushToken: true },
    });

    const deviceMap = new Map(parents.map((p) => [p.id, parseStoredExpoPushDevices(p.expoPushToken)]));

    const messages = items.flatMap((item) => {
        const devices = deviceMap.get(item.parentId) || [];
        return devices.map((device) =>
          buildPushMessage(device, item.title, item.body, item.data, item.data?.channelId)
        );
      });

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
    console.log(`[PUSH-BATCH] Sent ${messages.length} individualized notifications`);
  } catch (error) {
    console.error("[PUSH-INDIVIDUAL-BATCH-ERROR]", error);
  }
}

/**
 * Sends push notifications directly to raw Expo push tokens with chunking and error reporting.
 */
export async function sendDirectPushTokens(
  tokens: string[],
  title: string,
  body: string,
  options?: { channelId?: PushChannelId; data?: any; sound?: string; priority?: "default" | "normal" | "high" }
): Promise<{ success: boolean; sentCount: number; tickets: any[] }> {
  const devices = expandStoredExpoPushDevices(tokens);
  if (devices.length === 0) {
    return { success: false, sentCount: 0, tickets: [] };
  }

  const messages = devices.map((device) =>
    buildPushMessage(
      device,
      title,
      body,
      options?.data || {},
      options?.channelId,
      options?.sound,
      options?.priority || 'high'
    )
  );

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: any[] = [];
  for (const chunk of chunks) {
    try {
      // Use direct HTTP for reliability on Vercel serverless
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(chunk),
      });
      const result = await response.json();
      if (result.data) {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        tickets.push(...data);
      }
      console.log(`[sendDirectPushTokens] Expo API response: ${JSON.stringify(result)}`);
    } catch (err) {
      console.error("[sendDirectPushTokens] Direct HTTP failed, trying SDK:", err);
      try {
        const res = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...res);
      } catch (sdkErr) {
        console.error("[sendDirectPushTokens] SDK also failed:", sdkErr);
      }
    }
  }

  const sentCount = tickets.filter((t) => t.status === "ok").length;
  console.log(`[sendDirectPushTokens] Sent ${sentCount}/${devices.length}: "${title}"`);
  return { success: sentCount > 0, sentCount, tickets };
}

/**
 * Sends push notifications to teachers in a school or specific teacher IDs.
 */
export async function sendPushToTeachers({
  schoolId,
  teacherIds,
  title,
  body,
  options,
}: {
  schoolId: string;
  teacherIds?: string[];
  title: string;
  body: string;
  options?: { channelId?: PushChannelId; data?: any; sound?: string };
}): Promise<{ count: number; validTokensCount: number; success: boolean }> {
  const where: any = { schoolId };
  if (teacherIds && teacherIds.length > 0) {
    where.id = { in: teacherIds };
  }

  const teachers = await prisma.teacher.findMany({
    where,
    select: { id: true, name: true, surname: true, expoPushToken: true },
  });

  const storedTokens = teachers.map((teacher) => teacher.expoPushToken).filter((value): value is string => Boolean(value));
  const deviceCount = expandStoredExpoPushDevices(storedTokens).length;

  if (deviceCount > 0) {
    const res = await sendDirectPushTokens(storedTokens, title, body, options);
    return { count: teachers.length, validTokensCount: deviceCount, success: res.success };
  }

  return { count: teachers.length, validTokensCount: 0, success: false };
}

/**
 * Creates notifications for parents when a new notice is published.
 */
export async function createAnnouncementNotifications(noticeId: number) {
  try {
    const notice = await prisma.notice.findUnique({
      where: { id: noticeId },
      include: { class: true, targetStudent: true },
    });

    if (!notice) return;

    let parentIds: string[] = [];

    if (notice.targetStudentId) {
      // 1. Specific Student notice
      const student = await prisma.student.findUnique({
        where: { id: notice.targetStudentId },
        select: { parentId: true, schoolId: true },
      });
      if (student?.parentId && student.schoolId === notice.schoolId) parentIds = [student.parentId];
    } else if (notice.classId) {
      // 2. Class notice
      const students = await prisma.student.findMany({
        where: { classId: notice.classId, schoolId: notice.schoolId, parentId: { not: null } },
        select: { parentId: true },
      });
      parentIds = Array.from(new Set(students.map((s) => s.parentId).filter((id): id is string => Boolean(id))));
    } else {
      // 3. Global notice
      const parents = await prisma.parent.findMany({
        where: { schoolId: notice.schoolId },
        select: { id: true },
      });
      parentIds = parents.map((p) => p.id);
    }

    // Create notifications in batch
    await prisma.notification.createMany({
      data: parentIds.map((parentId) => ({
        schoolId: notice.schoolId,
        parentId,
        type: "ANNOUNCEMENT",
        title: notice.title,
        message: notice.important 
          ? `عاجل: ${notice.message.substring(0, 100)}...` 
          : notice.message.substring(0, 150) + (notice.message.length > 150 ? "..." : ""),
        studentId: notice.targetStudentId || null,
      })),
    });

    // Send push notifications in batch
    await sendPushBatch(
      parentIds,
      notice.important ? `🚨 عاجل: ${notice.title}` : `📢 ${notice.title}`,
      notice.message.substring(0, 100) + (notice.message.length > 100 ? "..." : ""),
      { 
        type: "ANNOUNCEMENT", 
        noticeId: notice.id,
        channelId: notice.important ? "emergency" : "default" 
      }
    );

    console.log(`[NOTIFICATIONS] Created ${parentIds.length} announcement notifications for notice ${noticeId}`);
  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating announcement notifications:", error);
  }
}

/**
 * Scans for students who haven't paid for the current month and reminds parents.
 * Can be called by a cron job, manually triggered endpoint, or AI Telegram assistant.
 */
export async function processPaymentReminders(
  force: boolean = false,
  schoolId?: string,
  targetStudentId?: string,
  targetClassId?: number
) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  try {
    const studentWhere: any = {};
    if (schoolId) studentWhere.schoolId = schoolId;
    if (targetStudentId) studentWhere.id = targetStudentId;
    if (targetClassId) studentWhere.classId = targetClassId;

    // 1. Find all eligible students
    const students = await prisma.student.findMany({
      where: studentWhere,
      include: {
        parent: true,
        class: true,
        payments: {
          where: {
            month: currentMonth,
            year: currentYear,
            userType: "STUDENT",
          },
        },
      },
    });

    let remindersSent = 0;

    for (const student of students) {
      if (!student.parent || !student.parentId) continue;

      const isPaid = student.payments.some((p) => p.status === "PAID");
      
      if (!isPaid) {
        const isPartial = student.payments.some((p) => p.status === "PARTIAL");
        const partialPayment = student.payments.find((p) => p.status === "PARTIAL");
        const remaining = partialPayment?.deferredAmount;

        // 2. Check for existing payment notification for this cycle
        const existingNotify = await prisma.notification.findFirst({
          where: {
            parentId: student.parentId,
            studentId: student.id,
            type: "PAYMENT",
            createdAt: {
              gte: new Date(currentYear, currentMonth - 1, 1),
            },
          },
          orderBy: { createdAt: "desc" },
        });

        const shouldRemind = force || !existingNotify || 
          (now.getTime() - new Date(existingNotify.updatedAt).getTime() > SIX_HOURS_MS);

        if (shouldRemind) {
          const monthFrench = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(now);
          const title = isPartial 
            ? `تذكير بالخلاص • Reliquat Scolarité (${student.name})`
            : `تذكير بالخلاص • Frais de Scolarité (${student.name})`;

          const message = isPartial
            ? `تذكير: نرجو تسوية المتبقي (${remaining ? remaining + " DT" : "المبلغ المتبقي"}) من معاليم دراسة ${student.name} لشهر ${monthFrench} ${currentYear}.\n\nRappel : Merci de régulariser le reliquat de scolarité pour ${student.name} pour le mois de ${monthFrench} ${currentYear}.`
            : `تذكير: نرجو تسوية معاليم دراسة ${student.name} لشهر ${monthFrench} ${currentYear} في أقرب الآجال.\n\nRappel : Les frais de scolarité pour ${student.name} pour le mois de ${monthFrench} ${currentYear} sont en attente de règlement.`;

          if (existingNotify && !force) {
            // Update the existing one (bump timestamp and mark as unread)
            await prisma.notification.update({
              where: { id: existingNotify.id },
              data: {
                isRead: false,
                updatedAt: now,
                message,
                title,
              },
            });
          } else {
            // Create new notification
            await prisma.notification.create({
              data: {
                schoolId: student.schoolId,
                parentId: student.parentId,
                studentId: student.id,
                type: "PAYMENT",
                title,
                message,
              },
            });
          }
          
          // Send push notification via Expo
          await sendPush(
            student.parentId,
            `💰 ${title}`,
            message.split("\n")[0] || message,
            { type: "PAYMENT", studentId: student.id }
          );

          remindersSent++;
        }
      }
    }

    return { success: true, count: remindersSent };
  } catch (error) {
    console.error("[NOTIFICATIONS] Error processing payment reminders:", error);
    return { success: false, error };
  }
}

/**
 * Direct message / notification dispatch to mobile parents from administration or AI.
 * Creates records in prisma.notification and dispatches push notifications.
 */
export async function sendMobileMessageToParents({
  schoolId,
  parentIds,
  studentId,
  title,
  message,
  type = "MESSAGE",
  data = {},
}: {
  schoolId: string;
  parentIds: string[];
  studentId?: string | null;
  title: string;
  message: string;
  type?: "MESSAGE" | "PAYMENT" | "REMINDER" | "ANNOUNCEMENT" | "ATTENDANCE" | "GRADE";
  data?: any;
}): Promise<{ count: number; pushTokensCount: number; pushSentCount: number }> {
  if (!parentIds || parentIds.length === 0) return { count: 0, pushTokensCount: 0, pushSentCount: 0 };

  const uniqueParentIds = Array.from(new Set(parentIds));

  // 1. Create notifications in DB for mobile app retrieval
  await prisma.notification.createMany({
    data: uniqueParentIds.map((parentId) => ({
      schoolId,
      parentId,
      studentId: studentId || null,
      type,
      title,
      message,
    })),
  });

  // 2. Dispatch push notifications via Expo
  const pushRes = await sendPushBatch(
    uniqueParentIds,
    title,
    message.substring(0, 140) + (message.length > 140 ? "..." : ""),
    {
      type,
      studentId: studentId || undefined,
      ...data,
    }
  );

  return {
    count: uniqueParentIds.length,
    pushTokensCount: pushRes.tokensCount,
    pushSentCount: pushRes.sentCount,
  };
}

/**
 * Creates a notification for a parent when a student is marked as ABSENT or LATE.
 */
export async function createAttendanceNotification(studentId: string, status: string, date: Date, lessonId?: number | null) {
  try {
    if (status === 'PRESENT') return;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { name: true, parentId: true, schoolId: true }
    });
    if (!student) return;

    const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const statusLabel = status === 'ABSENT' ? 'غائب' : 'متأخر';
    
    let lessonInfo = '';
    if (lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { subject: true, teacher: true }
      });
      if (lesson && lesson.subject && lesson.teacher) {
        const timeStr = lesson.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        lessonInfo = ` في حصة ${lesson.subject.name} على الساعة ${timeStr}`;
      }
    }
    
    // If student has no parent assigned, skip sending notification
    if (!student.parentId) return;

    await prisma.notification.create({
      data: {
        schoolId: student.schoolId,
        parentId: student.parentId,
        studentId: studentId,
        type: "ATTENDANCE",
        title: `تنبيه الحضور: ${status === 'ABSENT' ? 'غياب' : 'تأخير'}`,
        message: `تم تسجيل ${student.name} كـ ${statusLabel} يوم ${dateStr}${lessonInfo}.`,
      }
    });

    // Send push notification
    await sendPush(
      student.parentId,
      `📍 الحضور: ${status === 'ABSENT' ? 'غياب' : 'تأخير'}`,
      `${student.name} ${statusLabel}${lessonInfo ? lessonInfo : ` اليوم (${dateStr})`}.`,
      { type: "ATTENDANCE", studentId, channelId: "emergency" }
    );

    console.log(`[NOTIFICATIONS] Created attendance alert for ${studentId} (${status})`);
  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating attendance notification:", error);
  }
}

/**
 * Creates attendance notifications in bulk for absent/late students and dispatches push in batch.
 */
export async function createAttendanceNotificationsBatch(
  records: { studentId: string; status: string }[],
  date: Date,
  lessonId?: number | null
) {
  try {
    const nonPresent = records.filter((r) => r.status !== "PRESENT");
    if (nonPresent.length === 0) return;

    const studentIds = Array.from(new Set(nonPresent.map((r) => r.studentId)));
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true, parentId: true, schoolId: true },
    });

    if (students.length === 0) return;

    const studentMap = new Map(students.map((s) => [s.id, s]));

    let lessonInfo = "";
    if (lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { subject: true, teacher: true },
      });
      if (lesson && lesson.subject && lesson.teacher) {
        const timeStr = lesson.startTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        lessonInfo = ` في حصة ${lesson.subject.name} على الساعة ${timeStr}`;
      }
    }

    const dateStr = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const notificationsData: {
      schoolId: string;
      parentId: string;
      studentId: string;
      type: "ATTENDANCE";
      title: string;
      message: string;
    }[] = [];

    const pushItems: {
      parentId: string;
      title: string;
      body: string;
      data: any;
    }[] = [];

    for (const r of nonPresent) {
      const student = studentMap.get(r.studentId);
      if (!student || !student.parentId) continue;

      const statusLabel = r.status === "ABSENT" ? "غائب" : "متأخر";
      notificationsData.push({
        schoolId: student.schoolId,
        parentId: student.parentId,
        studentId: student.id,
        type: "ATTENDANCE",
        title: `تنبيه الحضور: ${r.status === "ABSENT" ? "غياب" : "تأخير"}`,
        message: `تم تسجيل ${student.name} كـ ${statusLabel} يوم ${dateStr}${lessonInfo}.`,
      });

      pushItems.push({
        parentId: student.parentId,
        title: `📍 الحضور: ${r.status === "ABSENT" ? "غياب" : "تأخير"}`,
        body: `${student.name} ${statusLabel}${lessonInfo ? lessonInfo : ` اليوم (${dateStr})`}.`,
        data: { type: "ATTENDANCE", studentId: student.id, channelId: "emergency" },
      });
    }

    // 1 single batch write for all DB notifications
    if (notificationsData.length > 0) {
      await prisma.notification.createMany({
        data: notificationsData,
      });
    }

    // Dispatch Expo push notifications in background without blocking response
    sendPushIndividualBatch(pushItems).catch((err) =>
      console.error("[NOTIFICATIONS] Error sending batch push:", err)
    );

    console.log(
      `[NOTIFICATIONS] Created batch attendance alerts for ${notificationsData.length} records`
    );
  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating batch attendance notifications:", error);
  }
}

/**
 * Creates notifications for parents when a new assignment is published.
 */
export async function createAssignmentNotification(assignmentId: number) {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { lesson: { include: { class: true, subject: true } } },
    });

    if (!assignment) return;

    const students = await prisma.student.findMany({
      where: { classId: assignment.lesson.classId, parentId: { not: null } },
      select: { parentId: true, id: true, name: true, schoolId: true },
    });

    const validStudents = students.filter((s): s is typeof s & { parentId: string } => Boolean(s.parentId));
    const parentIds = Array.from(new Set(validStudents.map((s) => s.parentId)));

    const rawSubject = assignment.lesson.subject.name || "";
    const cleanSubject = rawSubject.split('|')[0].trim();

    // Create database notifications
    await prisma.notification.createMany({
      data: validStudents.map((s) => ({
        schoolId: s.schoolId,
        parentId: s.parentId,
        studentId: s.id,
        type: "ANNOUNCEMENT",
        title: `📝 مهمة جديدة: ${assignment.title}`,
        message: `تم تعيين مهمة جديدة في ${cleanSubject} لـ ${s.name}.`,
      })),
    });

    // Send push notifications in batch
    await sendPushBatch(
      parentIds,
      `📝 مهمة جديدة: ${assignment.title}`,
      `تمت إضافة مهمة جديدة في ${cleanSubject}.`,
      { type: "HOMEWORK", homeworkId: assignment.id }
    );

    console.log(`[NOTIFICATIONS] Created ${validStudents.length} assignment notifications for assignment ${assignmentId}`);
  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating assignment notification:", error);
  }
}

/**
 * Creates notifications for parents when a new resource is published.
 */
export async function createResourceNotification(resourceId: number) {
  try {
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: { lesson: { include: { class: true, subject: true } } },
    });

    if (!resource) return;

    const students = await prisma.student.findMany({
      where: { classId: resource.lesson.classId, parentId: { not: null } },
      select: { parentId: true, id: true, name: true, schoolId: true },
    });

    const validStudents = students.filter((s): s is typeof s & { parentId: string } => Boolean(s.parentId));

    // Create database notifications
    await prisma.notification.createMany({
      data: validStudents.map((s) => ({
        schoolId: s.schoolId,
        parentId: s.parentId,
        studentId: s.id,
        type: "ANNOUNCEMENT",
        title: `📚 ملخص جديد: ${resource.title}`,
        message: `تمت إضافة مواد تعليمية جديدة في مادة ${resource.lesson.subject.name}.`,
      })),
    });

    // Send push notifications in batch
    const parentIds = Array.from(new Set(validStudents.map((s) => s.parentId)));
    await sendPushBatch(
      parentIds,
      `📚 ملخص جديد: ${resource.title}`,
      `تمت إضافة مواد تعليمية جديدة في مادة ${resource.lesson.subject.name}.`,
      { type: "RESOURCE", resourceId: resource.id }
    );

    console.log(`[NOTIFICATIONS] Created ${validStudents.length} resource notifications for resource ${resourceId}`);
  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating resource notification:", error);
  }
}

/**
 * Sends a detailed high-absence alert to a parent.
 */
export async function createDetailedAbsenceAlert(studentId: string, history: { date: string; lessonName: string }[]) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { name: true, surname: true, parentId: true, schoolId: true }
    });
    if (!student || !student.parentId) return;

    const count = history.length;
    // Deduplication: Don't send more than one absence alert per 7 days
    const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const existing = await prisma.notification.findFirst({
      where: {
        parentId: student.parentId,
        studentId: studentId,
        type: 'ATTENDANCE',
        message: { contains: 'missed' },
        createdAt: { gte: SEVEN_DAYS_AGO }
      }
    });

    if (existing) {
      console.log(`[DETAILED-ALERT-SKIP] Duplicate alert for ${studentId} (${count} absences) skipped. Already notified in the last 7 days.`);
      return { success: true };
    }

    const historyText = history.map(h => {
      const d = new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${d} (${h.lessonName})`;
    }).join(", ");

    const title = `🚨 Critical Attendance Alert`;
    const message = `Your child has missed ${count} sessions this month. Missed sessions: ${historyText}. Please contact the administration immediately to discuss this matter.`;

    await prisma.notification.create({
      data: {
        schoolId: student.schoolId,
        parentId: student.parentId,
        studentId: studentId,
        type: "ATTENDANCE",
        title,
        message,
      }
    });

    await sendPush(
      student.parentId,
      title,
      message,
      { type: "ATTENDANCE", studentId, channelId: "emergency" }
    );

    console.log(`[DETAILED-ALERT] Sent to ${student.parentId} for student ${studentId}`);
    return { success: true };
  } catch (error) {
    console.error("[DETAILED-ALERT-ERROR]", error);
    throw error;
  }
}

/**
 * Creates a notification for a parent when a teacher leaves a remark on their child.
 */
export async function createRemarkNotification(studentId: string, subjectName: string, remarkText: string) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { name: true, parentId: true }
    });
    if (!student || !student.parentId) return;

    const truncated = remarkText.length > 100 ? remarkText.substring(0, 100) + '...' : remarkText;

    await prisma.notification.create({
      data: {
        parentId: student.parentId,
        studentId,
        type: "ANNOUNCEMENT",
        title: `📝 ملاحظة المعلم — ${subjectName}`,
        message: `تمت إضافة ملاحظة لـ ${student.name}: "${truncated}"`,
        schoolId: (await prisma.student.findUnique({ where: { id: studentId }, select: { schoolId: true } }))?.schoolId || "default_school"
      }
    });

    await sendPush(
      student.parentId,
      `📝 ملاحظة المعلم — ${subjectName}`,
      `"${truncated}"`,
      { type: "REMARK", studentId }
    );

    console.log(`[NOTIFICATIONS] Remark notification sent for student ${studentId}`);
  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating remark notification:", error);
  }
}

/**
 * Creates notifications for parents when an exam schedule is published/updated.
 */
export async function createExamScheduleNotification(classId: number, period: number) {
  try {
    const students = await prisma.student.findMany({
      where: { classId, parentId: { not: null } },
      select: { parentId: true, id: true, name: true, schoolId: true },
    });

    if (!students || students.length === 0) return;

    // We can just notify per parent
    const parentMap = new Map<string, string>(); // parentId -> schoolId
    for (const s of students) {
      if (s.parentId && !parentMap.has(s.parentId)) {
        parentMap.set(s.parentId, s.schoolId);
      }
    }

    const title = `📅 تحديث جدول الامتحانات`;
    const message = `تم توفير جدول الامتحانات الرسمي للفترة ${period}.`;

    const parentIds = Array.from(parentMap.keys());

    // Create database notifications
    await prisma.notification.createMany({
      data: parentIds.map((parentId) => ({
        parentId,
        type: "ANNOUNCEMENT",
        title,
        message,
        schoolId: parentMap.get(parentId) || "default_school"
      })),
    });

    // Send push notifications in batch
    await sendPushBatch(
      parentIds,
      title,
      message,
      { type: "EXAM_SCHEDULE", period }
    );

    console.log(`[NOTIFICATIONS] Created ${parentIds.length} exam schedule notifications for class ${classId}`);
  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating exam schedule notification:", error);
  }
}


/**
 * Notifies the teacher when a student/parent submits a task.
 */
export async function notifyTeacherTaskSubmitted(studentId: string, assignmentId: number) {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { lesson: { include: { teacher: true } } }
    });
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { name: true, surname: true }
    });

    if (!assignment || !student || !assignment.lesson.teacher?.expoPushToken) return;

    const devices = parseStoredExpoPushDevices(assignment.lesson.teacher.expoPushToken);
    if (devices.length === 0) return;
    await sendDirectPushTokens(
      [assignment.lesson.teacher.expoPushToken],
      `📝 وظيفة مسلمة`,
      `قام ${student.name} ${student.surname} بتسليم ${assignment.title}.`,
      {
        data: { type: 'TASK_SUBMISSION', assignmentId, studentId },
        channelId: 'snapschool_alerts_v2',
      }
    );
    console.log(`[PUSH-SENT] To teacher ${assignment.lesson.teacher.id} for task submission`);
  } catch (error) {
    console.error("[NOTIFY-TEACHER-TASK]", error);
  }
}

/**
 * Notifies the teacher when a parent justifies an absence.
 */
export async function notifyTeacherAbsenceJustified(attendanceId: number) {
  try {
    const record = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { 
        student: { select: { name: true, surname: true } },
        lesson: { include: { teacher: true } }
      }
    });

    if (!record || !record.student || !record.lesson?.teacher?.expoPushToken) return;

    const devices = parseStoredExpoPushDevices(record.lesson.teacher.expoPushToken);
    if (devices.length === 0) return;
    await sendDirectPushTokens(
      [record.lesson.teacher.expoPushToken],
      `✅ تبرير غياب`,
      `قام ولي أمر ${record.student.name} ${record.student.surname} بتبرير غيابه.`,
      {
        data: { type: 'ATTENDANCE_JUSTIFICATION', attendanceId },
        channelId: 'snapschool_alerts_v2',
      }
    );
    console.log(`[PUSH-SENT] To teacher ${record.lesson.teacher.id} for absence justification`);
  } catch (error) {
    console.error("[NOTIFY-TEACHER-ABSENCE]", error);
  }
}
