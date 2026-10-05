import { Expo } from "expo-server-sdk";

const MAX_TOKENS_PER_ACCOUNT = 8;

export type ExpoPushDevice = {
  token: string;
  channelVersion: number;
  platform?: 'android' | 'ios';
};

export function parseStoredExpoPushDevices(value: string | null | undefined): ExpoPushDevice[] {
  if (!value) return [];

  const trimmed = value.trim();
  if (Expo.isExpoPushToken(trimmed)) return [{ token: trimmed, channelVersion: 2 }];

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];

    const devices = new Map<string, ExpoPushDevice>();
    for (const item of parsed) {
      if (typeof item === "string" && Expo.isExpoPushToken(item)) {
        devices.set(item, { token: item, channelVersion: 2 });
      } else if (
        item &&
        typeof item === "object" &&
        typeof item.token === "string" &&
        Expo.isExpoPushToken(item.token)
      ) {
        const device: ExpoPushDevice = {
          token: item.token,
          channelVersion: Number.isInteger(item.channelVersion) && item.channelVersion >= 3
            ? item.channelVersion
            : 2,
        };
        if (item.platform === 'android' || item.platform === 'ios') device.platform = item.platform;
        devices.set(item.token, device);
      }
    }
    return Array.from(devices.values()).slice(-MAX_TOKENS_PER_ACCOUNT);
  } catch {
    return [];
  }
}

export function parseStoredExpoPushTokens(value: string | null | undefined): string[] {
  return parseStoredExpoPushDevices(value).map((device) => device.token);
}

export function storeExpoPushToken(
  currentValue: string | null | undefined,
  token: string,
  channelVersion = 2,
  platform?: 'android' | 'ios'
): string {
  const devices = parseStoredExpoPushDevices(currentValue).filter((device) => device.token !== token);
  const device: ExpoPushDevice = { token, channelVersion: channelVersion >= 3 ? channelVersion : 2 };
  if (platform) device.platform = platform;
  devices.push(device);
  const retained = devices.slice(-MAX_TOKENS_PER_ACCOUNT);
  if (retained.length === 1 && retained[0].channelVersion === 2 && !retained[0].platform) return retained[0].token;
  return JSON.stringify(retained);
}

export function expandStoredExpoPushTokens(values: Array<string | null | undefined>): string[] {
  return expandStoredExpoPushDevices(values).map((device) => device.token);
}

export function expandStoredExpoPushDevices(values: Array<string | null | undefined>): ExpoPushDevice[] {
  const devices = new Map<string, ExpoPushDevice>();
  for (const value of values) {
    for (const device of parseStoredExpoPushDevices(value)) devices.set(device.token, device);
  }
  return Array.from(devices.values());
}
