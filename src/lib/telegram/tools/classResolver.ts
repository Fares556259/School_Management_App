import prisma from "@/lib/prisma";

const ARABIC_ORDINALS: Record<string, string> = {
  "أولى": "1", "الاولى": "1", "اولى": "1",
  "ثانية": "2", "الثانية": "2", "ثانيه": "2",
  "ثالثة": "3", "الثالثة": "3", "ثالثه": "3",
  "رابعة": "4", "الرابعة": "4", "رابعه": "4",
  "خامسة": "5", "الخامسة": "5", "خامسه": "5",
  "سادسة": "6", "السادسة": "6", "سادسه": "6",
  "سابعة": "7", "السابعة": "7", "سابعه": "7",
  "ثامنة": "8", "الثامنة": "8", "ثامنه": "8",
  "تاسعة": "9", "التاسعة": "9", "تاسعه": "9",
};

const ARABIC_LETTERS: Record<string, string> = {
  "أ": "A", "ا": "A", "ب": "B", "ج": "C", "د": "D", "ه": "E",
};

/**
 * Robust class resolver supporting French ordinals, English codes, Arabic ordinals, and fuzzy matching:
 * e.g. "CLASS 1A", "1ère A", "1ere A", "1 A", "classe 4ème A", "4A", "3ème A", "سنة ثالثة أ", "كلاس 3A" -> resolves to Class record
 */
export async function resolveClassByName(schoolId: string, rawQuery?: string | null) {
  if (!rawQuery || !rawQuery.trim()) return null;
  const query = rawQuery.trim();

  // 1. Direct contains match (case-insensitive)
  let target = await prisma.class.findFirst({
    where: { schoolId, name: { contains: query, mode: "insensitive" } },
  });
  if (target) return target;

  // 2. Normalize Arabic and French ordinals
  let qNormalized = query
    .replace(/(?:^|\s+)(?:classe|class|salle|room|سنة|صف|قسم|كلاس)(?:\s+|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [ar, num] of Object.entries(ARABIC_ORDINALS)) {
    qNormalized = qNormalized.replace(new RegExp(`(?:^|\\s+)${ar}(?:\\s+|$)`, "gi"), ` ${num} `);
  }
  for (const [ar, lat] of Object.entries(ARABIC_LETTERS)) {
    qNormalized = qNormalized.replace(new RegExp(`(?:^|\\s+)${ar}(?:\\s+|$)`, "gi"), ` ${lat} `);
  }

  const normalized = qNormalized
    .replace(/(\d+)\s*(?:ère|ere|er|ème|eme|ieme|e)\s*([a-zA-Z]?)/gi, "$1$2")
    .replace(/\s+/g, "")
    .trim();

  if (normalized) {
    target = await prisma.class.findFirst({
      where: { schoolId, name: { contains: normalized, mode: "insensitive" } },
    });
    if (target) return target;
  }

  // 3. Extract alphanumeric code pattern (e.g. "1A", "4B", "5C", "3A")
  const allClasses = await prisma.class.findMany({
    where: { schoolId },
    select: { id: true, name: true, capacity: true, supervisorId: true, levelId: true, schoolId: true },
  });

  const codeMatch = normalized.match(/(\d+)\s*([a-zA-Z])/);
  if (codeMatch) {
    const candidate = `${codeMatch[1]}${codeMatch[2]}`.toLowerCase();
    const byCode = allClasses.find((c) => c.name.replace(/\s+/g, "").toLowerCase() === candidate);
    if (byCode) return byCode;
  }

  // 4. Stripped alphanumeric comparison
  const cleanQ = normalized
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "")
    .toLowerCase();

  const matched = allClasses.find((c) => {
    const cClean = c.name.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "").toLowerCase();
    return cClean === cleanQ || cClean.includes(cleanQ) || cleanQ.includes(cClean);
  });

  return matched || null;
}
