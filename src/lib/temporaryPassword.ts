import { randomInt } from "crypto";

/**
 * Generate a short numeric credential that a school administrator can read
 * over the phone. Eight digits keep it easy to type while the existing login
 * rate limits protect the temporary credential from repeated guessing.
 */
export function generateTemporaryParentPassword(): string {
  return randomInt(10_000_000, 100_000_000).toString();
}
