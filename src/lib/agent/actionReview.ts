import { createHash } from 'node:crypto';

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}

/** Binds the displayed proposal to its exact arguments; ownership is verified separately. */
export function actionReviewFingerprint(id: string, name: string, args: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical({ version: 1, id, name, args }))).digest('hex');
}
export function sameActionArguments(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}
