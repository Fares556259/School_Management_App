import { unstable_cache, revalidateTag } from "next/cache";

/**
 * Multi-Tenant Caching Architecture for SnapSchool Web
 * 
 * Provides type-safe tenant-scoped caching and instant write-through invalidation.
 */

export const CACHE_TAGS = {
  all: (schoolId: string) => `tenant-${schoolId}`,
  dashboard: (schoolId: string) => `tenant-${schoolId}-dashboard`,
  resources: (schoolId: string) => `tenant-${schoolId}-resources`,
  teachers: (schoolId: string) => `tenant-${schoolId}-teachers`,
  students: (schoolId: string) => `tenant-${schoolId}-students`,
  classes: (schoolId: string) => `tenant-${schoolId}-classes`,
  subjects: (schoolId: string) => `tenant-${schoolId}-subjects`,
  finance: (schoolId: string) => `tenant-${schoolId}-finance`,
  incomes: (schoolId: string) => `tenant-${schoolId}-incomes`,
  expenses: (schoolId: string) => `tenant-${schoolId}-expenses`,
  parents: (schoolId: string) => `tenant-${schoolId}-parents`,
  staff: (schoolId: string) => `tenant-${schoolId}-staff`,
  attendance: (schoolId: string) => `tenant-${schoolId}-attendance`,
  assignments: (schoolId: string) => `tenant-${schoolId}-assignments`,
  exams: (schoolId: string) => `tenant-${schoolId}-exams`,
  institution: (schoolId: string) => `tenant-${schoolId}-institution`,
} as const;

export type CacheDomain = keyof typeof CACHE_TAGS;

/**
 * Generic Cached Multi-Tenant Data Fetcher
 *
 * @param schoolId - Tenant school identifier
 * @param domain - Cache domain (e.g. 'resources', 'dashboard', 'teachers')
 * @param keyParts - Unique identifier parts for the query (filters, page, etc.)
 * @param fetchFn - Async function returning the data from database
 * @param revalidateSec - Background revalidation duration in seconds (default 300s / 5min)
 */
export async function getCachedTenantData<T>(
  schoolId: string,
  domain: CacheDomain,
  keyParts: (string | number | boolean | undefined | null)[],
  fetchFn: () => Promise<T>,
  revalidateSec: number = 300
): Promise<T> {
  const normalizedKey = [
    `tenant-${schoolId}`,
    domain,
    ...keyParts.map(p => (p !== undefined && p !== null ? String(p) : 'null'))
  ];

  const domainTag = CACHE_TAGS[domain](schoolId);
  const globalTenantTag = CACHE_TAGS.all(schoolId);

  const cachedFn = unstable_cache(
    fetchFn,
    normalizedKey,
    {
      revalidate: revalidateSec,
      tags: [globalTenantTag, domainTag]
    }
  );

  return cachedFn();
}

/**
 * Instant Write-Through Invalidator
 * Call this inside server actions or API routes whenever records are mutated.
 *
 * @param schoolId - Tenant school identifier
 * @param domains - One or more domains to invalidate (e.g. 'resources', 'dashboard')
 */
export function invalidateTenantTags(
  schoolId: string,
  ...domains: CacheDomain[]
): void {
  if (!schoolId) return;

  for (const domain of domains) {
    if (domain === 'all') {
      revalidateTag(CACHE_TAGS.all(schoolId));
    } else if (CACHE_TAGS[domain]) {
      const tag = CACHE_TAGS[domain](schoolId);
      try {
        revalidateTag(tag);
      } catch (err) {
        console.warn(`[Cache Invalidate] Error invalidating tag ${tag}:`, err);
      }
    }
  }
}
