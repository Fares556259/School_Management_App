/**
 * Helper to build comprehensive multi-word name and phone search conditions
 * for Prisma queries across Student, Parent, Teacher, and Staff models.
 *
 * Handles:
 * - Single names ("Fares", "Selmi")
 * - Full names ("Fares Selmi", "fares test")
 * - Inverted names ("Selmi Fares")
 * - Multi-part names ("Mohamed Ali Ben Amor")
 * - Phone numbers with spaces or dashes ("12 345 678", "123456789")
 * - Honorific stripping ("Mme Hnia Selmi", "مدام هنية")
 * - Arabic transliteration ("هنية سلمي" -> "hnia selmi")
 */

/**
 * Strips common honorifics in Arabic, French, and English:
 * e.g. "مدام هنية سلمي" -> "هنية سلمي", "Mme Hnia Selmi" -> "Hnia Selmi"
 */
export function cleanHonorifics(query: string): string {
  if (!query) return "";
  return query
    .replace(
      /(?:^|\s+)(مدام|مادام|أستاذة|استاذة|الاستاذة|المدام|أستاذ|استاذ|الاستاذ|سي|سيد|سيدة|الشيخ|monsieur|madame|mme|mlle|mr|m\.|mme\.|prof|professeur|docteur|dr|eleve|élève|tuteur|parent)(?:\s+|$)/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

const COMMON_ARABIC_NAMES: Record<string, string[]> = {
  "هنية": ["hnia", "henia", "hania", "hnya"],
  "سلمي": ["selmi", "salmi", "selmy", "salmy"],
  "السالمي": ["selmi", "salmi"],
  "فارس": ["fares", "faris"],
  "محمد": ["mohamed", "mohammed", "muhammad"],
  "علي": ["ali"],
  "أحمد": ["ahmed", "ahmad"],
  "فاطمة": ["fatma", "fatima"],
  "نجاة": ["najet", "najat"],
  "مريم": ["mariem", "meriem", "maryam"],
  "يوسف": ["youssef", "yousef"],
  "سارة": ["sara", "sarah"],
  "عمر": ["omar"],
  "خالد": ["khaled", "khalid"],
  "بلقاسم": ["belgacem", "belkacem"],
  "طارق": ["tarek", "tarik"],
  "حمزة": ["hamza"],
  "زياد": ["zied", "ziad"],
  "مراد": ["mourad", "morad"],
  "سامي": ["sami"],
  "وليد": ["walid"],
  "كريم": ["karim"],
  "لطفي": ["lotfi"],
  "أيمن": ["aymen", "ayman"],
  "إيناس": ["ines"],
  "سيرين": ["sirine", "cyrine"],
  "عبير": ["abir"],
  "ريم": ["rim", "reem"],
  "هدى": ["houda", "hoda"],
  "نور": ["nour"],
  "أمينة": ["amina", "amine"],
  "يسرى": ["yousra"],
  "شيماء": ["chaima", "chaimaa"],
  "وئام": ["wiem"],
  "أمل": ["amel", "amal"],
  "منى": ["mouna", "mona"],
  "سلوى": ["salwa"],
  "سمية": ["soumaya"],
  "درة": ["dorra"],
  "هالة": ["hela", "hala"],
  "سنية": ["sonia"],
  "أنيس": ["anis"],
  "حسام": ["houssem", "hossam"],
  "إسماعيل": ["ismail"],
  "ياسين": ["yassine", "yassin"],
  "ماهر": ["maher"],
  "صابر": ["saber"],
  "رمزي": ["ramzi"],
  "وسيم": ["wassim"],
  "توفيق": ["taoufik", "toufik"],
  "رضا": ["ridha", "reda"],
  "شكري": ["chokri"],
  "منصف": ["moncef"],
  "قيس": ["kais"],
  "حبيب": ["habib"],
  "منجي": ["mongi"],
  "رياض": ["riadh"],
  "عزيز": ["aziz"],
  "مهدي": ["mehdi"],
  "بلال": ["bilel", "bilal"],
};

export function transliterateArabicWord(word: string): string[] {
  const clean = word.trim().replace(/[ًٌٍَُِّْـ]/g, ""); // Strip Arabic diacritics
  if (COMMON_ARABIC_NAMES[clean]) {
    return COMMON_ARABIC_NAMES[clean];
  }

  // Generic phonetic mapping
  const charMap: Record<string, string> = {
    "أ": "a", "إ": "i", "آ": "a", "ا": "a", "ء": "", "ئ": "i", "ؤ": "ou",
    "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh",
    "د": "d", "ذ": "z", "ر": "r", "ز": "z", "س": "s", "ش": "ch",
    "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh",
    "ف": "f", "ق": "k", "ك": "k", "ل": "l", "م": "m", "ن": "n",
    "ه": "h", "و": "ou", "ي": "i", "ى": "a", "ة": "a"
  };

  let res = "";
  for (const c of clean) {
    if (charMap[c] !== undefined) res += charMap[c];
    else res += c;
  }
  return [res];
}

/**
 * Returns candidate transliterated Latin strings for an Arabic name.
 */
export function transliterateArabicQuery(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  let results: string[] = [""];
  for (const w of words) {
    const variants = transliterateArabicWord(w);
    const next: string[] = [];
    for (const prefix of results) {
      for (const v of variants) {
        next.push(prefix ? `${prefix} ${v}` : v);
      }
    }
    results = next.slice(0, 8);
  }
  return results;
}

export function buildNameSearchConditions(query: string) {
  const clean = cleanHonorifics(query);
  const q = clean.trim() || query.trim();
  if (!q) return [];

  const cleanPhone = q.replace(/[\s\-\.]/g, "");
  const words = q.split(/\s+/).filter(Boolean);

  const orConditions: any[] = [
    { name: { contains: q, mode: "insensitive" } },
    { surname: { contains: q, mode: "insensitive" } },
  ];

  if (cleanPhone.length >= 3 && /^\+?\d+$/.test(cleanPhone)) {
    orConditions.push({ phone: { contains: cleanPhone } });
  }

  if (words.length >= 2) {
    // Matches if every single word is present in either name or surname
    orConditions.push({
      AND: words.map((w) => ({
        OR: [
          { name: { contains: w, mode: "insensitive" } },
          { surname: { contains: w, mode: "insensitive" } },
        ],
      })),
    });

    // Explicit first-word / rest-words split (e.g. name="fares", surname="selmi")
    const firstPart = words[0];
    const restPart = words.slice(1).join(" ");
    orConditions.push({
      AND: [
        { name: { contains: firstPart, mode: "insensitive" } },
        { surname: { contains: restPart, mode: "insensitive" } },
      ],
    });

    // Inverted split (e.g. surname first: name="selmi", surname="fares")
    orConditions.push({
      AND: [
        { name: { contains: restPart, mode: "insensitive" } },
        { surname: { contains: firstPart, mode: "insensitive" } },
      ],
    });
  }

  // Also include conditions for transliterated variants if query is Arabic
  if (/[\u0600-\u06FF]/.test(q)) {
    const transliteratedVariants = transliterateArabicQuery(q);
    for (const variant of transliteratedVariants) {
      if (!variant || variant === q) continue;
      const vWords = variant.split(/\s+/).filter(Boolean);
      orConditions.push({ name: { contains: variant, mode: "insensitive" } });
      orConditions.push({ surname: { contains: variant, mode: "insensitive" } });

      if (vWords.length >= 2) {
        orConditions.push({
          AND: vWords.map((w) => ({
            OR: [
              { name: { contains: w, mode: "insensitive" } },
              { surname: { contains: w, mode: "insensitive" } },
            ],
          })),
        });
        const vFirst = vWords[0];
        const vRest = vWords.slice(1).join(" ");
        orConditions.push({
          AND: [
            { name: { contains: vFirst, mode: "insensitive" } },
            { surname: { contains: vRest, mode: "insensitive" } },
          ],
        });
        orConditions.push({
          AND: [
            { name: { contains: vRest, mode: "insensitive" } },
            { surname: { contains: vFirst, mode: "insensitive" } },
          ],
        });
      }
    }
  }

  return orConditions;
}
