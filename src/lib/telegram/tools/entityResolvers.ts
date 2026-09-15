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
    const matches = await prisma.teacher.findMany({
      where: { schoolId, OR: nameConds },
      take: 15,
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const words = clean.split(/\s+/).filter(Boolean);
      const ranked = matches
        .map((t) => ({ teacher: t, score: scorePersonMatch(t, words) }))
        .sort((a, b) => b.score - a.score);
      if (ranked.length > 0 && ranked[0].score > 0) return ranked[0].teacher;
    }
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

// ── STUDENT RANKING & SCORING ALGORITHM ──────────────────────────────────────
/**
 * Comprehensive Student Matching & Ranking Algorithm:
 * - Prioritizes exact full name match (+1000)
 * - Strictly respects class match (+2000) and heavily penalizes wrong class (-5000)
 * - Rewards parent match (+1000)
 * - Deprioritizes substring/prefix matches and test artifacts (e.g. mmWiem, Wiemmmm, Wiemtest)
 */
export function rankStudentMatch(
  student: {
    id: string;
    name: string;
    surname: string;
    class?: { name?: string | null } | null;
    parent?: { name?: string | null; surname?: string | null; phone?: string | null; id?: string } | null;
  },
  queryClean: string,
  targetClass?: string | null,
  targetParent?: string | null
): number {
  const cName = (student.name || "").toLowerCase().trim();
  const cSurname = (student.surname || "").toLowerCase().trim();
  const full1 = `${cName} ${cSurname}`.trim();
  const full2 = `${cSurname} ${cName}`.trim();

  function scoreText(qText: string): number {
    const q = qText.toLowerCase().trim();
    if (!q) return 0;
    const qWords = q.split(/\s+/).filter(Boolean);

    // 1. Exact full name match
    if (full1 === q || full2 === q) return 1000;
    if (full1.replace(/\s+/g, "") === q.replace(/\s+/g, "")) return 980;

    // 2. Exact token-level match (e.g. name is "Wiem" and surname is "Marzouki")
    if (qWords.length >= 2) {
      const w1 = qWords[0];
      const wRest = qWords.slice(1).join(" ");
      if ((cName === w1 && cSurname === wRest) || (cSurname === w1 && cName === wRest)) {
        return 950;
      }
      // Word prefix match (e.g. "Wiem" prefix of "Wiemtest")
      if ((cName.startsWith(w1) && cSurname.startsWith(wRest)) || (cSurname.startsWith(w1) && cName.startsWith(wRest))) {
        const excess = Math.abs(cName.length - w1.length) + Math.abs(cSurname.length - wRest.length);
        return Math.max(100, 600 - excess * 25);
      }
      // Substring match (e.g. "Wiem" inside "mmWiem" or "Wiemmmm")
      if ((cName.includes(w1) && cSurname.includes(wRest)) || (cSurname.includes(w1) && cName.includes(wRest))) {
        const excess = Math.abs(cName.length - w1.length) + Math.abs(cSurname.length - wRest.length);
        return Math.max(50, 400 - excess * 25);
      }
      if (qWords.every((w) => cName.includes(w) || cSurname.includes(w))) {
        return 300;
      }
    } else if (qWords.length === 1) {
      const single = qWords[0];
      if (cName === single || cSurname === single) {
        return 850;
      }
      if (cName.startsWith(single) || cSurname.startsWith(single)) {
        const excess = Math.min(Math.abs(cName.length - single.length), Math.abs(cSurname.length - single.length));
        return Math.max(100, 500 - excess * 20);
      }
      if (cName.includes(single) || cSurname.includes(single)) {
        return 250;
      }
    }
    return 0;
  }

  let baseScore = scoreText(queryClean);
  if (/[\u0600-\u06FF]/.test(queryClean)) {
    const transliteratedVariants = transliterateArabicQuery(queryClean);
    for (const variant of transliteratedVariants) {
      const s = scoreText(variant);
      if (s > baseScore) baseScore = s;
    }
  }

  if (baseScore === 0) return 0;
  let totalScore = baseScore;

  if (targetClass && targetClass.trim()) {
    const normTarget = targetClass.toLowerCase().replace(/[^a-z0-9]/g, "");
    const candClass = (student.class?.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (candClass) {
      if (candClass === normTarget || candClass.includes(normTarget) || normTarget.includes(candClass)) {
        totalScore += 2000;
      } else {
        totalScore -= 5000; // Penalize wrong class heavily
      }
    } else {
      totalScore -= 200;
    }
  }

  if (targetParent && targetParent.trim()) {
    const normParent = targetParent.toLowerCase().replace(/\s+/g, "");
    const pFull = `${student.parent?.name || ""} ${student.parent?.surname || ""}`.toLowerCase().replace(/\s+/g, "");
    const pPhone = (student.parent?.phone || "").replace(/[\s\-\.]/g, "");
    if (pFull.includes(normParent) || pPhone.includes(normParent) || student.parent?.id === targetParent) {
      totalScore += 1000;
    }
  }

  return totalScore;
}

// ── STUDENT RESOLVER ─────────────────────────────────────────────────────────
export async function resolveStudentByName(
  schoolId: string,
  rawQuery?: string | null,
  classHint?: string | null,
  parentHint?: string | null
) {
  if (!rawQuery || !rawQuery.trim()) return null;
  const raw = rawQuery.trim();

  // 1. Direct ID lookup
  const byId = await prisma.student.findFirst({
    where: { schoolId, id: raw },
    include: { class: true, parent: true, level: true },
  });
  if (byId) return byId;

  // 2. Extract embedded class hint or parent hint
  let queryText = raw;
  let targetClass = classHint?.trim();
  let targetParent = parentHint?.trim();

  // Strip common payment action words if full sentence was passed
  queryText = queryText
    .replace(/(?:^|\s+)(?:a\s+pay[eé]|pay[eé]|a\s+vers[eé]|vers[eé]|a\s+donn[eé]|donn[eé]|خلص|خلصت|خالص|دفعت?)(?:\s+|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Class clue in query: e.g. "Bringa bring 3A", "Bringa bring (3A)", "Bringa bring de 3A"
  const classMatch = queryText.match(/\b(?:en\s+|classe\s+|de\s+)?([1-9][A-Za-z]|[1-9]ème\s*[A-Za-z]?)\b/i);
  if (classMatch) {
    if (!targetClass) {
      targetClass = classMatch[1];
    }
    queryText = queryText.replace(classMatch[0], " ").trim();
  }

  // Parent clue in query: e.g. "(Parent moune saoud)", "wled moune saoud", "fils de moune saoud"
  const parentMatch = queryText.match(/(?:\(?(?:parent|tuteur|père|mère|wled|weldet|bent|fils de|fille de)[:\s]+([^)]+)\)?)/i);
  if (parentMatch) {
    if (!targetParent) {
      targetParent = parentMatch[1].trim();
    }
    queryText = queryText.replace(parentMatch[0], " ").trim();
  }

  const clean = cleanHonorifics(queryText.replace(/[()]/g, " ")).trim();
  if (!clean) return null;

  // 3. Prisma name search conditions
  const nameConds = buildNameSearchConditions(clean);
  if (nameConds.length > 0) {
    const matchingStudents = await prisma.student.findMany({
      where: { schoolId, OR: nameConds },
      include: { class: true, parent: true, level: true },
      take: 25,
    });

    if (matchingStudents.length > 0) {
      const ranked = matchingStudents
        .map((s) => ({ student: s, score: rankStudentMatch(s, clean, targetClass, targetParent) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      if (ranked.length > 0) {
        return ranked[0].student;
      }
    }
  }

  // 4. In-memory candidate search fallback
  const allStudents = await prisma.student.findMany({
    where: { schoolId },
    include: { class: true, parent: true, level: true },
  });

  const rankedAll = allStudents
    .map((s) => ({ student: s, score: rankStudentMatch(s, clean, targetClass, targetParent) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (rankedAll.length > 0) {
    return rankedAll[0].student;
  }

  return null;
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
    const matches = await prisma.staff.findMany({
      where: { schoolId, OR: nameConds },
      take: 15,
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const words = clean.split(/\s+/).filter(Boolean);
      const ranked = matches
        .map((s) => ({ staff: s, score: scorePersonMatch(s, words) }))
        .sort((a, b) => b.score - a.score);
      if (ranked.length > 0 && ranked[0].score > 0) return ranked[0].staff;
    }
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
  const raw = rawQuery.trim();

  // 1. Direct ID lookup
  const byId = await prisma.parent.findFirst({
    where: { schoolId, id: raw },
    include: { students: { include: { class: true } } },
  });
  if (byId) return byId;

  // 2. Extract phone if present (e.g. "+216 6458558", "6458558", "12345678")
  const phoneMatch = raw.match(/(?:\+216\s*)?(\d{6,12})/);
  const phoneDigits = phoneMatch ? phoneMatch[1] : null;
  if (phoneDigits) {
    const byPhone = await prisma.parent.findFirst({
      where: {
        schoolId,
        phone: { contains: phoneDigits },
      },
      include: { students: { include: { class: true } } },
    });
    if (byPhone) return byPhone;
  }

  // 3. Strip parenthesized text & phone numbers to get clean name
  const textWithoutParens = raw.replace(/\([^)]*\)/g, " ").trim();
  const cleanName = cleanHonorifics(
    textWithoutParens.replace(/(?:\+216)?\s*\d{6,12}/g, " ").trim()
  ).trim();

  if (cleanName) {
    const nameConds = buildNameSearchConditions(cleanName);
    if (nameConds.length > 0) {
      const byName = await prisma.parent.findFirst({
        where: { schoolId, OR: nameConds },
        include: { students: { include: { class: true } } },
      });
      if (byName) return byName;
    }
  }

  // 4. In-memory candidate search
  const allParents = await prisma.parent.findMany({
    where: { schoolId },
    select: { id: true, name: true, surname: true, phone: true },
  });

  const matched = matchPersonCandidates(allParents, cleanName || raw);
  if (!matched) return null;

  return prisma.parent.findUnique({
    where: { id: matched.id },
    include: { students: { include: { class: true } } },
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
