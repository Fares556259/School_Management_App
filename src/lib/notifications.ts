import prisma from "./prisma";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

/**
 * Sends a push notification to a parent via Expo.
 */
async function sendPush(parentId: string, title: string, body: string, data: any = {}) {
  try {
    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      select: { expoPushToken: true },
    });

    if (!parent?.expoPushToken || !Expo.isExpoPushToken(parent.expoPushToken)) {
      return;
    }

    const messages = [{
      to: parent.expoPushToken,
      sound: data.channelId === 'emergency' ? 'alert.m4a' : 'notification.m4a',
      title,
      body,
      data,
      channelId: data.channelId || 'default', 
    }];

    await expo.sendPushNotificationsAsync(messages);
    console.log(`[PUSH-SENT] To parent ${parentId}: ${title}`);
  } catch (error) {
    console.error("[PUSH-ERROR]", error);
  }
}

/**
 * Sends push notifications to multiple parents in a single batch.
 * Fetches all tokens in one query and uses Expo's batch API.
 */
async function sendPushBatch(parentIds: string[], title: string, body: string, data: any = {}) {
  if (parentIds.length === 0) return;
  try {
    const parents = await prisma.parent.findMany({
      where: { id: { in: parentIds } },
      select: { id: true, expoPushToken: true },
    });

    const messages = parents
      .filter(p => p.expoPushToken && Expo.isExpoPushToken(p.expoPushToken))
      .map(p => ({
        to: p.expoPushToken!,
        sound: data.channelId === 'emergency' ? 'alert.m4a' : 'notification.m4a',
        title,
        body,
        data,
        channelId: data.channelId || 'default',
      }));

    if (messages.length === 0) return;

    // Expo recommends sending in chunks of up to 100
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
    console.log(`[PUSH-BATCH] Sent ${messages.length} notifications: ${title}`);
  } catch (error) {
    console.error("[PUSH-BATCH-ERROR]", error);
  }
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
        select: { parentId: true },
      });
      if (student) parentIds = [student.parentId];
    } else if (notice.classId) {
      // 2. Class notice
      const students = await prisma.student.findMany({
        where: { classId: notice.classId },
        select: { parentId: true },
      });
      parentIds = Array.from(new Set(students.map((s) => s.parentId)));
    } else {
      // 3. Global notice
      const parents = await prisma.parent.findMany({
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
 * Can be called by a cron job or a manually triggered endpoint.
 */
export async function processPaymentReminders(force: boolean = false) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  try {
    // 1. Find all students
    const students = await prisma.student.findMany({
      include: {
        parent: true,
        payments: {
          where: {
            month: currentMonth,
            year: currentYear,
          },
        },
      },
    });

    let remindersSent = 0;

    for (const student of students) {
      const isPaid = student.payments.some((p) => p.status === "PAID");
      
      if (!isPaid) {
        // Unpaid or pending
        // 2. Check for existing payment notification for this cycle
        const existingNotify = await prisma.notification.findFirst({
          where: {
            parentId: student.parentId,
            studentId: student.id,
            type: "PAYMENT",
            // We consider it the "current" cycle if created in this month/year
            createdAt: {
               gte: new Date(currentYear, currentMonth - 1, 1)
            }
          },
          orderBy: { createdAt: 'desc' }
        });

        const shouldRemind = force || !existingNotify || 
          (now.getTime() - new Date(existingNotify.updatedAt).getTime() > SIX_HOURS_MS);

        if (shouldRemind) {
          const message = `Payment for ${student.name} for ${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now)} ${currentYear} is pending. Please settle at your earliest convenience.`;
          
          if (existingNotify && !force) {
            // Update the existing one (bump timestamp and mark as unread)
            await prisma.notification.update({
              where: { id: existingNotify.id },
              data: {
                isRead: false,
                updatedAt: now,
                message: message // Refresh message possibly
              }
            });
          } else {
            // Create new notification (Force always creates new for "Just now" timestamp)
            await prisma.notification.create({
              data: {
                schoolId: student.schoolId,
                parentId: student.parentId,
                studentId: student.id,
                type: "PAYMENT",
                title: "Payment Reminder",
                message: message,
              }
            });
          }
          
          // Send push notification
          await sendPush(
            student.parentId,
            "💰 Payment Reminder",
            message,
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
    
    // We removed aggressive deduplication here because the API route now ensures
    // notifications are only fired when the status ACTUALLY changes for a specific lesson.

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
      where: { classId: assignment.lesson.classId },
      select: { parentId: true, id: true, name: true, schoolId: true },
    });

    const parentIds = Array.from(new Set(students.map((s) => s.parentId)));

    const rawSubject = assignment.lesson.subject.name || "";
    const cleanSubject = rawSubject.split('|')[0].trim();

    // Create database notifications
    await prisma.notification.createMany({
      data: students.map((s) => ({
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

    console.log(`[NOTIFICATIONS] Created ${students.length} assignment notifications for assignment ${assignmentId}`);
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
      where: { classId: resource.lesson.classId },
      select: { parentId: true, id: true, name: true, schoolId: true },
    });

    // Create database notifications
    await prisma.notification.createMany({
      data: students.map((s) => ({
        schoolId: s.schoolId,
        parentId: s.parentId,
        studentId: s.id,
        type: "ANNOUNCEMENT",
        title: `📚 ملخص جديد: ${resource.title}`,
        message: `تمت إضافة مواد تعليمية جديدة في مادة ${resource.lesson.subject.name}.`,
      })),
    });

    // Send push notifications in batch
    const parentIds = Array.from(new Set(students.map((s) => s.parentId)));
    await sendPushBatch(
      parentIds,
      `📚 ملخص جديد: ${resource.title}`,
      `تمت إضافة مواد تعليمية جديدة في مادة ${resource.lesson.subject.name}.`,
      { type: "RESOURCE", resourceId: resource.id }
    );

    console.log(`[NOTIFICATIONS] Created ${students.length} resource notifications for resource ${resourceId}`);
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
    if (!student) return;

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
    if (!student) return;

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
      where: { classId },
      select: { parentId: true, id: true, name: true, schoolId: true },
    });

    if (!students || students.length === 0) return;

    // We can just notify per parent
    const parentMap = new Map<string, string>(); // parentId -> schoolId
    for (const s of students) {
      if (!parentMap.has(s.parentId)) {
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
