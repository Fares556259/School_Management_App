import prisma from "@/lib/prisma";
import { Day } from "@prisma/client";
import {
  cleanHonorifics,
  transliterateArabicQuery,
  buildNameSearchConditions,
} from "./nameSearch";
import { resolveClassByName } from "./classResolver";

export { resolveClassByName, cleanHonorifics, transliterateArabicQuery, buildNameSearchConditions };

// ── PERSON IN-MEMORY SCORER ──────────────────────────────────────────────────
function scorePersonMatch(
  candidate: { id: string; name: string; surname: string; phone?: string | null },
  queryWords: string[]
): number {
  const cName = (candidate.name || "").toLowerCase().trim();
  const cSurname = (candidate.surname || "").toLowerCase().trim();
  const full1 = `${cName} ${cSurname}`.trim();
  const full2 = `${cSurname} ${cName}`.trim();
  const queryStr = queryWords.join(" ").toLowerCase().trim();

  // Exact full name match
  if (full1 === queryStr || full2 === queryStr) return 1.0;
  if (full1.replace(/\s+/g, "") === queryStr.replace(/\s+/g, "")) return 0.98;

  // Check phone exact match
  const cleanPhone = queryStr.replace(/[\s\-\.]/g, "");
  if (cleanPhone.length >= 4 && candidate.phone && candidate.phone.includes(cleanPhone)) {
    return 0.97;
  }

  // Multi-word checks
  if (queryWords.length >= 2) {
    // First word matches name and second matches surname (or vice versa)
    const firstWord = queryWords[0];
    const restWord = queryWords.slice(1).join(" ");
    if (
      (cName.includes(firstWord) && cSurname.includes(restWord)) ||
      (cSurname.includes(firstWord) && cName.includes(restWord))
    ) {
      return 0.96;
    }

    // All words match either name or surname
    const allWordsMatch = queryWords.every((w) => cName.includes(w) || cSurname.includes(w));
    if (allWordsMatch) return 0.94;
  }

  // Single word query
  if (queryWords.length === 1) {
    const single = queryWords[0];
    if (cName === single || cSurname === single) return 0.92;
    if (cName.includes(single) || cSurname.includes(single)) return 0.82;
  }

  return 0;
}

function matchPersonCandidates<T extends { id: string; name: string; surname: string; phone?: string | null }>(
  candidates: T[],
  query: string
): T | null {
  if (!candidates || candidates.length === 0) return null;

  const clean = cleanHonorifics(query).trim().toLowerCase();
  if (!clean) return null;

  // Try direct Latin words
  const latinWords = clean.split(/\s+/).filter(Boolean);
  let bestCandidate: T | null = null;
  let bestScore = 0;

  for (const c of candidates) {
    const score = scorePersonMatch(c, latinWords);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = c;
    }
  }

  if (bestScore >= 0.8) {
    return bestCandidate;
  }

  // Try Arabic transliteration variants if query has Arabic
  if (/[\u0600-\u06FF]/.test(clean)) {
    const transliteratedVariants = transliterateArabicQuery(clean);
    for (const variant of transliteratedVariants) {
      const vWords = variant.split(/\s+/).filter(Boolean);
      for (const c of candidates) {
        const score = scorePersonMatch(c, vWords);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = c;
        }
      }
    }
  }

  return bestScore >= 0.8 ? bestCandidate : null;
}

// ── TEACHER RESOLVER ─────────────────────────────────────────────────────────
export async function resolveTeacherByName(schoolId: string, rawQuery?: string | null) {
  if (!rawQuery || !rawQuery.trim()) return null;
  const clean = cleanHonorifics(rawQuery).trim();
  if (!clean) return null;

  // 1. Direct ID lookup
  const byId = await prisma.teacher.findFirst({
    where: { schoolId, id: clean },
  });
  if (byId) return byId;

  // 2. Prisma name search conditions
  const nameConds = buildNameSearchConditions(clean);
  if (nameConds.length > 0) {
    const direct = await prisma.teacher.findFirst({
      where: { schoolId, OR: nameConds },
    });
    if (direct) return direct;
  }

  // 3. In-memory candidate search across school teachers
  const allTeachers = await prisma.teacher.findMany({
    where: { schoolId },
    select: { id: true, name: true, surname: true, phone: true },
  });

  const matched = matchPersonCandidates(allTeachers, clean);
  if (!matched) return null;

  return prisma.teacher.findUnique({
    where: { id: matched.id },
  });
}

// ── STUDENT RESOLVER ─────────────────────────────────────────────────────────
export async function resolveStudentByName(schoolId: string, rawQuery?: string | null) {
  if (!rawQuery || !rawQuery.trim()) return null;
  const clean = cleanHonorifics(rawQuery).trim();
  if (!clean) return null;

  // 1. Direct ID lookup
  const byId = await prisma.student.findFirst({
    where: { schoolId, id: clean },
    include: { class: true, parent: true, level: true },
  });
  if (byId) return byId;

  // 2. Prisma name search conditions
  const nameConds = buildNameSearchConditions(clean);
  if (nameConds.length > 0) {
    const direct = await prisma.student.findFirst({
      where: { schoolId, OR: nameConds },
      include: { class: true, parent: true, level: true },
    });
    if (direct) return direct;
  }

  // 3. In-memory candidate search
  const allStudents = await prisma.student.findMany({
    where: { schoolId },
    select: { id: true, name: true, surname: true, phone: true, classId: true },
  });

  const matched = matchPersonCandidates(allStudents, clean);
  if (!matched) return null;

  return prisma.student.findUnique({
    where: { id: matched.id },
    include: { class: true, parent: true, level: true },
  });
}

// ── STAFF RESOLVER ───────────────────────────────────────────────────────────
export async function resolveStaffByName(schoolId: string, rawQuery?: string | null) {
  if (!rawQuery || !rawQuery.trim()) return null;
  const clean = cleanHonorifics(rawQuery).trim();
  if (!clean) return null;

  // 1. Direct ID lookup
  const byId = await prisma.staff.findFirst({
    where: { schoolId, id: clean },
  });
  if (byId) return byId;

  // 2. Prisma search
  const nameConds = buildNameSearchConditions(clean);
  if (nameConds.length > 0) {
    const direct = await prisma.staff.findFirst({
      where: { schoolId, OR: nameConds },
    });
    if (direct) return direct;
  }

  // 3. In-memory candidate search
  const allStaff = await prisma.staff.findMany({
    where: { schoolId },
    select: { id: true, name: true, surname: true, phone: true, role: true },
  });

  const matched = matchPersonCandidates(allStaff, clean);
  if (!matched) return null;

  return prisma.staff.findUnique({
    where: { id: matched.id },
  });
}

// ── PARENT RESOLVER ──────────────────────────────────────────────────────────
export async function resolveParentByName(schoolId: string, rawQuery?: string | null) {
  if (!rawQuery || !rawQuery.trim()) return null;
  const clean = cleanHonorifics(rawQuery).trim();
  if (!clean) return null;

  // 1. Direct ID lookup
  const byId = await prisma.parent.findFirst({
    where: { schoolId, id: clean },
  });
  if (byId) return byId;

  // 2. Prisma search
  const nameConds = buildNameSearchConditions(clean);
  if (nameConds.length > 0) {
    const direct = await prisma.parent.findFirst({
      where: { schoolId, OR: nameConds },
    });
    if (direct) return direct;
  }

  // 3. In-memory candidate search
  const allParents = await prisma.parent.findMany({
    where: { schoolId },
    select: { id: true, name: true, surname: true, phone: true },
  });

  const matched = matchPersonCandidates(allParents, clean);
  if (!matched) return null;

  return prisma.parent.findUnique({
    where: { id: matched.id },
  });
}

// ── SUBJECT RESOLVER ─────────────────────────────────────────────────────────
const SUBJECT_SYNONYMS: Record<string, string[]> = {
  anglais: ["anglais", "english", "ang", "eng", "انقليزي", "انجليزي", "أونقلي", "اونقلي", "إنقليزي"],
  arabe: ["arabe", "arabic", "arab", "عربية", "عربي", "العربية"],
  francais: ["francais", "français", "french", "fr", "فرنسية", "الفرنسية"],
  math: ["math", "maths", "mathematiques", "mathématiques", "mathematics", "رياضيات", "مات", "الرياضيات"],
  physique: ["physique", "physics", "chimie", "chimique", "فيزياء", "الفيزياء", "كيمياء"],
  svt: ["svt", "science", "sciences", "biologie", "biology", "علوم", "العلوم", "علوم الحياة والأرض"],
  histoire: ["histoire", "geographie", "géo", "geo", "history", "geography", "تاريخ", "جغرافيا", "تاريخ وجغرافيا"],
  informatique: ["informatique", "info", "computer", "it", "technologie", "اعلامية", "الإعلامية", "حاسوب"],
  sport: ["sport", "eps", "sportif", "رياضة", "الرياضة", "تربية بدنية"],
  musique: ["musique", "music", "موسيقى", "الموسيقى"],
  philosophie: ["philosophie", "philo", "philosophy", "فلسفة", "الفلسفة"],
  islamique: ["islamique", "islam", "religion", "تربية اسلامية", "اسلامية", "التربية الإسلامية"],
  economie: ["economie", "gestion", "eco", "economics", "إقتصاد", "اقتصاد", "تصرف"],
  art: ["art", "arts", "dessin", "فنون", "رسم", "تربية تشكيلية"],
};

export async function resolveSubjectByName(schoolId: string, rawQuery?: string | null) {
  if (!rawQuery || !rawQuery.trim()) return null;
  const q = rawQuery.trim();

  // 1. Direct contains match (case-insensitive)
  const direct = await prisma.subject.findFirst({
    where: { schoolId, name: { contains: q, mode: "insensitive" } },
  });
  if (direct) return direct;

  // 2. Fetch all school subjects for synonym / fuzzy matching
  const allSubjects = await prisma.subject.findMany({
    where: { schoolId },
    select: { id: true, name: true },
  });
  if (allSubjects.length === 0) return null;

  const qLower = q.toLowerCase();

  // Check if query is in any synonym category
  let foundGroup: string | null = null;
  for (const [group, syns] of Object.entries(SUBJECT_SYNONYMS)) {
    if (syns.some((syn) => qLower === syn || qLower.includes(syn) || syn.includes(qLower))) {
      foundGroup = group;
      break;
    }
  }

  if (foundGroup) {
    const syns = SUBJECT_SYNONYMS[foundGroup];
    const match = allSubjects.find((s) => {
      const sName = s.name.toLowerCase();
      return syns.some((syn) => sName === syn || sName.includes(syn) || syn.includes(sName));
    });
    if (match) return match;
  }

  // Fuzzy substring match against all school subjects
  const fallback = allSubjects.find((s) => {
    const sName = s.name.toLowerCase();
    return sName.includes(qLower) || qLower.includes(sName);
  });

  return fallback || null;
}

// ── ROOM RESOLVER ────────────────────────────────────────────────────────────
export async function resolveRoomByName(schoolId: string, rawQuery?: string | null) {
  if (!rawQuery || !rawQuery.trim()) return null;
  const q = rawQuery.trim();

  // 1. Direct contains match
  const direct = await prisma.room.findFirst({
    where: { schoolId, name: { contains: q, mode: "insensitive" } },
  });
  if (direct) return direct;

  // 2. Strip prefixes ("Salle", "Room", "قاعة", "صال", "في")
  const stripped = q
    .replace(/(?:^|\s+)(?:salle|room|classe|صال|الصال|قاعة|القاعة|غرفة|الغرفة|في|au|en)(?:\s+|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped) {
    const byStripped = await prisma.room.findFirst({
      where: { schoolId, name: { contains: stripped, mode: "insensitive" } },
    });
    if (byStripped) return byStripped;
  }

  // 3. Check all school rooms for room number containment
  const allRooms = await prisma.room.findMany({
    where: { schoolId },
    select: { id: true, name: true },
  });

  const targetId = stripped || q;
  const matched = allRooms.find((r) => {
    const rClean = r.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
    const qClean = targetId.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
    return rClean === qClean || rClean.includes(qClean) || qClean.includes(rClean);
  });

  return matched || null;
}

// ── DAY OF WEEK RESOLVER ─────────────────────────────────────────────────────
export function resolveDayOfWeek(rawDay?: string | null): { dayEnum: Day; displayDay: string } {
  const clean = (rawDay || "").toLowerCase().trim();

  // Relative: Today / Aujourd'hui / اليوم
  if (!clean || ["today", "aujourd'hui", "aujourdhui", "اليوم", "lyoum", "leyloum"].some((k) => clean.includes(k))) {
    const d = new Date().getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    switch (d) {
      case 2:
        return { dayEnum: "TUESDAY", displayDay: "mardi" };
      case 3:
        return { dayEnum: "WEDNESDAY", displayDay: "mercredi" };
      case 4:
        return { dayEnum: "THURSDAY", displayDay: "jeudi" };
      case 5:
        return { dayEnum: "FRIDAY", displayDay: "vendredi" };
      case 6:
        return { dayEnum: "SATURDAY", displayDay: "samedi" };
      case 1:
      default:
        return { dayEnum: "MONDAY", displayDay: "lundi" };
    }
  }

  // Specific days
  if (["lundi", "monday", "الاثنين", "الإثنين", "tnin", "1"].some((s) => clean.includes(s))) {
    return { dayEnum: "MONDAY", displayDay: "lundi" };
  }
  if (["mardi", "tuesday", "الثلاثاء", "tlat", "2"].some((s) => clean.includes(s))) {
    return { dayEnum: "TUESDAY", displayDay: "mardi" };
  }
  if (["mercredi", "wednesday", "الأربعاء", "الاربعاء", "erbaa", "3"].some((s) => clean.includes(s))) {
    return { dayEnum: "WEDNESDAY", displayDay: "mercredi" };
  }
  if (["jeudi", "thursday", "الخميس", "khmis", "4"].some((s) => clean.includes(s))) {
    return { dayEnum: "THURSDAY", displayDay: "jeudi" };
  }
  if (["vendredi", "friday", "الجمعة", "jom3a", "5"].some((s) => clean.includes(s))) {
    return { dayEnum: "FRIDAY", displayDay: "vendredi" };
  }
  if (["samedi", "saturday", "السبت", "sebt", "6"].some((s) => clean.includes(s))) {
    return { dayEnum: "SATURDAY", displayDay: "samedi" };
  }

  return { dayEnum: "MONDAY", displayDay: "lundi" };
}
