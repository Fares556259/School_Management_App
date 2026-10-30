const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_CHUNK_SIZE = 100;

export type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
};

export function isExpoPushToken(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(value);
}

export function chunkExpoPushMessages<T>(messages: T[]): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < messages.length; index += EXPO_PUSH_CHUNK_SIZE) {
    chunks.push(messages.slice(index, index + EXPO_PUSH_CHUNK_SIZE));
  }
  return chunks;
}

export async function sendExpoPushMessages(messages: unknown[]): Promise<ExpoPushTicket[]> {
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunkExpoPushMessages(messages)) {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(12_000),
    });

    const payload = await response.json().catch(() => null);
    if (response.ok === false) {
      const message = payload?.errors?.[0]?.message || payload?.message || `Expo push HTTP ${response.status}`;
      throw new Error(message);
    }

    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      throw new Error(payload.errors.map((error: any) => error?.message || "Expo push error").join("; "));
    }

    const chunkTickets = Array.isArray(payload?.data) ? payload.data : payload?.data ? [payload.data] : [];
    tickets.push(...chunkTickets);
  }

  return tickets;
}
