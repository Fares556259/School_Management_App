import prisma from "./prisma";

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
        parentId,
        type: "ANNOUNCEMENT",
        title: notice.title,
        message: notice.important 
          ? `URGENT: ${notice.message.substring(0, 100)}...` 
          : notice.message.substring(0, 150) + (notice.message.length > 150 ? "..." : ""),
        studentId: notice.targetStudentId || null,
      })),
    });

    console.log(`[NOTIFICATIONS] Created ${parentIds.length} announcement notifications for notice ${noticeId}`);
  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating announcement notifications:", error);
  }
}

/**
 * Scans for students who haven't paid for the current month and reminds parents.
 * Can be called by a cron job or a manually triggered endpoint.
 */
export async function processPaymentReminders() {
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

        const shouldRemind = !existingNotify || 
          (now.getTime() - new Date(existingNotify.updatedAt).getTime() > SIX_HOURS_MS);

        if (shouldRemind) {
          const message = `Payment for ${student.name} for ${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now)} ${currentYear} is pending. Please settle at your earliest convenience.`;
          
          if (existingNotify) {
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
            // Create new notification
            await prisma.notification.create({
              data: {
                parentId: student.parentId,
                studentId: student.id,
                type: "PAYMENT",
                title: "Payment Reminder",
                message: message,
              }
            });
          }
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
export async function createAttendanceNotification(studentId: string, status: string, date: Date) {
  try {
    if (status === 'PRESENT') return;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { name: true, parentId: true }
    });
    if (!student) return;

    const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const statusLabel = status === 'ABSENT' ? 'absent' : 'late';
    
    // Deduplication: Don't send the same status alert twice in the same day for the same student
    const START_OF_DAY = new Date();
    START_OF_DAY.setHours(0, 0, 0, 0);

    const existing = await prisma.notification.findFirst({
      where: {
        parentId: student.parentId,
        studentId: studentId,
        type: 'ATTENDANCE',
        createdAt: { gte: START_OF_DAY },
        message: { contains: statusLabel }
      }
    });

    if (existing) return;

    await prisma.notification.create({
      data: {
        parentId: student.parentId,
        studentId: studentId,
        type: "ATTENDANCE",
        title: `Attendance Alert: ${status}`,
        message: `${student.name} has been marked as ${statusLabel} on ${dateStr}.`,
      }
    });

    console.log(`[NOTIFICATIONS] Created attendance alert for ${studentId} (${status})`);
  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating attendance notification:", error);
  }
}
