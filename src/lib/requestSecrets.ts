import { timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function hasValidBearerSecret(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const authorization = request.headers.get("authorization") || "";
  return safeEqual(authorization, `Bearer ${secret}`);
}

export function hasValidHeaderSecret(
  request: Request,
  headerName: string,
  secret: string | undefined
): boolean {
  if (!secret) return false;
  const provided = request.headers.get(headerName);
  return provided !== null && safeEqual(provided, secret);
}
