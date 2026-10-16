import prisma from './prisma';

// Server-owned active admin membership, never a role/tenant supplied by the client.
export async function getParentAccessAdmin(readUser?: () => Promise<{ id: string } | null>) {
  const user = readUser ? await readUser() : await (await import("@/utils/supabase/server")).getAuthenticatedUser();
  if (!user) return null;
  return prisma.admin.findFirst({ where: { id: user.id, status: 'active' }, select: { id: true, schoolId: true } });
}
