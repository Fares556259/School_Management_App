const DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"] as const;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CIRCUIT_COOLDOWN_MS = 60_000;

type ModelHealth = {
  blockedUntil: number;
  failures: number;
};

const modelHealth = new Map<string, ModelHealth>();

function clampInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function getMobileHniaModels(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.HNIA_MOBILE_MODEL || "").trim();
  return [...new Set([configured, ...DEFAULT_MODELS].filter(Boolean))];
}

export function getHniaModelTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  return clampInteger(env.HNIA_MODEL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 45_000);
}

export function isRetryableModelError(error: unknown): boolean {
  const candidate = error as { status?: number; message?: string; name?: string } | null;
  const status = Number(candidate?.status || 0);
  if (status === 404 || status === 408 || status === 409 || status === 429 || status >= 500) return true;
  if (status === 400 || status === 401 || status === 403) return false;

  const text = `${candidate?.name || ""} ${candidate?.message || ""}`.toLowerCase();
  return /(abort|timeout|timed out|network|fetch failed|overload|unavailable|temporar|capacity|rate limit|quota)/.test(text);
}

export function markModelFailure(
  model: string,
  now = Date.now(),
  cooldownMs = DEFAULT_CIRCUIT_COOLDOWN_MS
): void {
  const previous = modelHealth.get(model);
  modelHealth.set(model, {
    failures: (previous?.failures || 0) + 1,
    blockedUntil: now + cooldownMs,
  });
}

export function markModelSuccess(model: string): void {
  modelHealth.delete(model);
}

export function getAvailableModels(models: string[], now = Date.now()): string[] {
  const available = models.filter((model) => (modelHealth.get(model)?.blockedUntil || 0) <= now);
  // Always make one attempt, even if every model failed during the previous minute.
  return available.length > 0 ? available : models.slice(0, 1);
}

export function resetModelHealthForTests(): void {
  modelHealth.clear();
}
