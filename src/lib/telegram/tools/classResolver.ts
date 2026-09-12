import prisma from "@/lib/prisma";

/**
 * Robust class resolver supporting French ordinals, English codes, and fuzzy matching:
 * e.g. "CLASS 1A", "1ère A", "1ere A", "1 A", "classe 4ème A", "4A" -> resolves to Class record
 */
export async function resolveClassByName(schoolId: string, rawQuery?: string | null) {
  if (!rawQuery || !rawQuery.trim()) return null;
  const query = rawQuery.trim();

  // 1. Direct contains match (case-insensitive)
  let target = await prisma.class.findFirst({
    where: { schoolId, name: { contains: query, mode: "insensitive" } },
  });
  if (target) return target;

  // 2. Normalize French ordinals (1ère A -> 1A, 2ème B -> 2B) and strip generic prefixes
  const normalized = query
    .replace(/(\d+)\s*(?:ère|ere|er|ème|eme|ieme|e)\s*([a-zA-Z]?)/gi, "$1$2")
    .replace(/\b(?:classe|class|salle|room)\b/gi, "")
    .replace(/\s+/g, "")
    .trim();

  if (normalized) {
    target = await prisma.class.findFirst({
      where: { schoolId, name: { contains: normalized, mode: "insensitive" } },
    });
    if (target) return target;
  }

  // 3. Extract alphanumeric code pattern (e.g. "1A", "4B", "5C")
  const allClasses = await prisma.class.findMany({
    where: { schoolId },
    select: { id: true, name: true, capacity: true, supervisorId: true, levelId: true, schoolId: true },
  });

  const codeMatch = query.match(/(\d+)\s*([a-zA-Z])/);
  if (codeMatch) {
    const candidate = `${codeMatch[1]}${codeMatch[2]}`.toLowerCase();
    const byCode = allClasses.find((c) => c.name.replace(/\s+/g, "").toLowerCase() === candidate);
    if (byCode) return byCode;
  }

  // 4. Stripped alphanumeric comparison
  const cleanQ = query
    .replace(/\b(?:classe|class|salle|room)\b/gi, "")
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "")
    .toLowerCase();

  const matched = allClasses.find((c) => {
    const cClean = c.name.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "").toLowerCase();
    return cClean === cleanQ || cClean.includes(cleanQ) || cleanQ.includes(cClean);
  });

  return matched || null;
}
