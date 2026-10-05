import { Expo } from "expo-server-sdk";

const MAX_TOKENS_PER_ACCOUNT = 8;

export function parseStoredExpoPushTokens(value: string | null | undefined): string[] {
  if (!value) return [];

  const trimmed = value.trim();
  if (Expo.isExpoPushToken(trimmed)) return [trimmed];

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(parsed.filter((token): token is string => typeof token === "string" && Expo.isExpoPushToken(token)))
    ).slice(-MAX_TOKENS_PER_ACCOUNT);
  } catch {
    return [];
  }
}

export function storeExpoPushToken(
  currentValue: string | null | undefined,
  token: string
): string {
  const tokens = parseStoredExpoPushTokens(currentValue).filter((current) => current !== token);
  tokens.push(token);
  const retained = tokens.slice(-MAX_TOKENS_PER_ACCOUNT);
  return retained.length === 1 ? retained[0] : JSON.stringify(retained);
}

export function expandStoredExpoPushTokens(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.flatMap(parseStoredExpoPushTokens)));
}
