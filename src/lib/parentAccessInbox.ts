import prisma from '@/lib/prisma';

export type ParentAccessEntry = {
  id: string;
  parentId: string;
  status: string;
  relation: string;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  conflicting: boolean;
  parent: { id: string; name: string; surname: string; phone: string; address: string };
  student: { id: string; name: string; surname: string; nationalId: string | null; class: { id: number; name: string } | null };
};

export type ParentAccessInboxData = {
  requests: ParentAccessEntry[];
  counts: Record<string, number>;
  total: number;
  classes: { id: number; name: string }[];
  page: number;
  fetchedAt: string;
};

type InboxFilters = {
  status?: string;
  classId?: number;
  search?: string;
  page?: number;
  includeMeta?: boolean;
};

const ALLOWED_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED'] as const;

export function isParentAccessStatus(value: string): boolean {
  return ALLOWED_STATUSES.includes(value as (typeof ALLOWED_STATUSES)[number]);
}

export async function getParentAccessInboxData(
  schoolId: string,
  filters: InboxFilters = {},
): Promise<ParentAccessInboxData> {
  const status = filters.status && isParentAccessStatus(filters.status) ? filters.status : 'PENDING';
  const classId = filters.classId;
  const search = (filters.search || '').trim().slice(0, 100);
  const page = Math.max(1, Math.min(10_000, Math.floor(filters.page || 1)));
  const includeMeta = filters.includeMeta !== false;
  const where = {
    schoolId,
    status,
    ...(classId ? { student: { classId, schoolId } } : {}),
    ...(search ? {
      OR: [
        { parent: { name: { contains: search, mode: 'insensitive' as const } } },
        { parent: { surname: { contains: search, mode: 'insensitive' as const } } },
        { parent: { phone: { contains: search } } },
        { student: { name: { contains: search, mode: 'insensitive' as const } } },
        { student: { surname: { contains: search, mode: 'insensitive' as const } } },
        { student: { nationalId: { contains: search } } },
      ],
    } : {}),
  };

  const [requests, total, counts, classes, admins] = await Promise.all([
    prisma.parentAccessRequest.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * 25,
      take: 25,
      include: {
        parent: { select: { id: true, name: true, surname: true, phone: true, address: true } },
        student: {
          select: {
            id: true,
            name: true,
            surname: true,
            nationalId: true,
            parentId: true,
            class: { select: { id: true, name: true } },
            accessRequests: {
              where: { schoolId, status: 'PENDING' },
              select: { id: true, parentId: true },
            },
          },
        },
      },
    }),
    prisma.parentAccessRequest.count({ where }),
    includeMeta
      ? prisma.parentAccessRequest.groupBy({ by: ['status'], where: { schoolId }, _count: true })
      : Promise.resolve([]),
    includeMeta
      ? prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
    status === 'PENDING'
      ? Promise.resolve([])
      : prisma.admin.findMany({ where: { schoolId }, select: { id: true, name: true, surname: true } }),
  ]);

  const reviewers = new Map(admins.map(admin => [admin.id, [admin.name, admin.surname].filter(Boolean).join(' ')]));
  return {
    total,
    page,
    fetchedAt: new Date().toISOString(),
    classes,
    counts: Object.fromEntries(counts.map(group => [group.status, group._count])),
    requests: requests.map(({ student, ...request }) => ({
      ...request,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() || null,
      reviewedByName: request.reviewedBy ? reviewers.get(request.reviewedBy) || request.reviewedBy : null,
      student: { ...student, accessRequests: undefined },
      conflicting: Boolean(
        (student.parentId && student.parentId !== request.parentId)
        || student.accessRequests.some(accessRequest => accessRequest.parentId !== request.parentId),
      ),
    })),
  };
}
