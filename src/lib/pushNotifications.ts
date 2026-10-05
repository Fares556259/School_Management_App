import prisma from "@/lib/prisma";
import { sendDirectPushTokens } from "@/lib/notifications";

export interface SendPushNotificationParams {
  tokens: (string | null | undefined)[];
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: "default" | "emergency" | "snapschool_alerts_v1" | "snapschool_emergency_v1" | "snapschool_alerts_v2" | "snapschool_emergency_v2" | string;
}

/**
 * Sends real OS system push notifications to iOS (APNs) and Android (FCM) via Expo Push API.
 */
export async function sendSystemPushNotification({
  tokens,
  title,
  body,
  data = {},
  channelId = "default",
}: SendPushNotificationParams) {
  const storedTokens = tokens.filter((token): token is string => Boolean(token));

  if (storedTokens.length === 0) {
    console.log("[PUSH] No valid Expo push tokens to notify.");
    return;
  }

  await sendDirectPushTokens(storedTokens, title, body, {
    channelId: channelId as any,
    data,
  });
}

/**
 * Helper to notify parent of a student via OS system push notification
 */
export async function notifyParentOfStudent(
  studentId: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { parentId: true },
    });

    if (student?.parentId) {
      const parent = await prisma.parent.findUnique({
        where: { id: student.parentId },
        select: { expoPushToken: true },
      });

      if (parent?.expoPushToken) {
        await sendSystemPushNotification({
          tokens: [parent.expoPushToken],
          title,
          body,
          data,
        });
      }
    }
  } catch (error) {
    console.error("[NOTIFY PARENT ERROR]", error);
  }
}
