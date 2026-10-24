import prisma from './prisma';

// Server-owned active admin membership, never a role/tenant supplied by the client.
export async function getParentAccessAdmin(readUser?: () => Promise<{ id: string } | null>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let user: { id: string } | null;
  try {
    user = await Promise.race([
      readUser ? readUser() : import('@/utils/supabase/server').then(module => module.getAuthenticatedUser()),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('ADMIN_AUTH_TIMEOUT')), 8_000); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
  if (!user) return null;
  return prisma.admin.findFirst({ where: { id: user.id, status: 'active', School: { status: 'ACTIVE' } }, select: { id: true, schoolId: true } });
}
