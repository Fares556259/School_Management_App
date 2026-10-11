import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { getAuthenticatedUser } from "@/utils/supabase/server";

/** Student profile mutations require a server-owned admin membership. */
export async function getStudentAdminSchool(): Promise<string> {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Not authorized to manage students.");
  const schoolId = await getSchoolId();
  const admin = await prisma.admin.findFirst({ where: { id: user.id, schoolId }, select: { id: true } });
  if (!admin) throw new Error("Not authorized to manage students.");
  return schoolId;
}

/** Keep identifiers as text, including leading zeroes. Blank explicitly clears it. */
export function normalizeStudentNationalId(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") throw new Error("Invalid student identifier.");
  return value.trim() || null;
}
