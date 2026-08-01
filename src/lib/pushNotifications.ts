import { Expo, ExpoPushMessage } from "expo-server-sdk";
import prisma from "@/lib/prisma";

const expo = new Expo();

export interface SendPushNotificationParams {
  tokens: (string | null | undefined)[];
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: "default" | "emergency";
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
  const validTokens = tokens.filter(
    (t): t is string => !!t && Expo.isExpoPushToken(t)
  );

  if (validTokens.length === 0) {
    console.log("[PUSH] No valid Expo push tokens to notify.");
    return;
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
    channelId,
    priority: "high",
  }));

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log("[PUSH SUCCESS] Push ticket received:", ticketChunk);
    } catch (error) {
      console.error("[PUSH ERROR] Failed to send push notification chunk:", error);
    }
  }
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
