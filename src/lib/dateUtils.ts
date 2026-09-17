export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** 
 * Given a month param string (e.g. "2-2026"), return the "Month Year" key used in payment titles.
 * Defaults to the current month if no param is provided.
 */
export function getMonthKey(monthParam: string | undefined): string {
  const now = new Date();
  if (!monthParam) {
    let m = now.getMonth();
    let y = now.getFullYear();
    // Default to September of the upcoming year if it's July or August
    if (m === 6 || m === 7) m = 8;
    return `${MONTHS[m]} ${y}`;
  }
  const [m, y] = monthParam.split("-").map(Number);
  // Basic validation to avoid NaN errors
  if (isNaN(m) || isNaN(y)) {
    let currM = now.getMonth();
    let currY = now.getFullYear();
    if (currM === 6 || currM === 7) currM = 8;
    return `${MONTHS[currM]} ${currY}`;
  }
  return `${MONTHS[m]} ${y}`;
}

/** Returns the month before the given monthKey (e.g. "April 2026" -> "March 2026") */
export function getPreviousMonth(monthKey: string): string {
  const [mName, yStr] = monthKey.split(" ");
  let mIndex = MONTHS.indexOf(mName);
  let y = parseInt(yStr);

  if (mIndex === 0) {
    mIndex = 11;
    y--;
  } else {
    mIndex--;
  }
  return `${MONTHS[mIndex]} ${y}`;
}

/** Check if monthA is chronologically before monthB */
export function isMonthBefore(monthA: string, monthB: string): boolean {
  if (monthA === monthB) return false;
  
  const [mA_Name, yA_Str] = monthA.split(" ");
  const [mB_Name, yB_Str] = monthB.split(" ");
  
  const yA = parseInt(yA_Str);
  const yB = parseInt(yB_Str);
  const mA = MONTHS.indexOf(mA_Name);
  const mB = MONTHS.indexOf(mB_Name);

  if (yA !== yB) return yA < yB;
  return mA < mB;
}

/** Returns a list of months between startKey and endKey (exclusive of endKey) */
export function getMonthsBetween(startKey: string, endKey: string): string[] {
  const months = [];
  let current = startKey;
  while (isMonthBefore(current, endKey)) {
    months.push(current);
    current = getNextMonth(current);
  }
  return months;
}

/** Returns the month after the given monthKey */
export function getNextMonth(monthKey: string): string {
  const [mName, yStr] = monthKey.split(" ");
  let mIndex = MONTHS.indexOf(mName);
  let y = parseInt(yStr);

  if (mIndex === 11) {
    mIndex = 0;
    y++;
  } else {
    mIndex++;
  }
  return `${MONTHS[mIndex]} ${y}`;
}

/** Returns the 10 months of the academic year based on a given date */
export function getSchoolYearMonths(date: Date = new Date()): string[] {
  const currentMonthIndex = date.getMonth();
  const currentYear = date.getFullYear();

  // If Jan-Jun, year started in Sep last year. If Jul-Dec, starts Sep this year.
  const schoolYearStartYear = (currentMonthIndex >= 6) ? currentYear : currentYear - 1;

  const months = [
    { m: 8, y: schoolYearStartYear },        // Sep
    { m: 9, y: schoolYearStartYear },        // Oct
    { m: 10, y: schoolYearStartYear },       // Nov
    { m: 11, y: schoolYearStartYear },       // Dec
    { m: 0, y: schoolYearStartYear + 1 },    // Jan
    { m: 1, y: schoolYearStartYear + 1 },    // Feb
    { m: 2, y: schoolYearStartYear + 1 },    // Mar
    { m: 3, y: schoolYearStartYear + 1 },    // Apr
    { m: 4, y: schoolYearStartYear + 1 },    // May
    { m: 5, y: schoolYearStartYear + 1 },    // Jun
  ];

  return months.map(({ m, y }) => `${MONTHS[m]} ${y}`);
}

export const MONTHS_FR: Record<string, string> = {
  January: "Janvier",
  February: "Février",
  March: "Mars",
  April: "Avril",
  May: "Mai",
  June: "Juin",
  July: "Juillet",
  August: "Août",
  September: "Septembre",
  October: "Octobre",
  November: "Novembre",
  December: "Décembre",
};

export function formatMonthFrench(monthKey: string): string {
  if (!monthKey) return monthKey;
  const parts = monthKey.split(" ");
  if (parts.length >= 2 && MONTHS_FR[parts[0]]) {
    return `${MONTHS_FR[parts[0]]} ${parts.slice(1).join(" ")}`;
  }
  return MONTHS_FR[monthKey] || monthKey;
}

/**
 * Universal month-year parser that converts any month/year representation into:
 * - month: 1-12
 * - year: 4-digit year (e.g. 2026)
 * - monthKey: English canonical string (e.g. "September 2026")
 * - fullFrench: French localized string (e.g. "Septembre 2026")
 *
 * Supports English, French (with or without accents), Arabic (standard & Tunisian),
 * ISO ("2026-09"), and dash/slash formats ("9-2026", "09/2026").
 */
export function parseMonthYear(
  input?: string | { month?: number; year?: number } | null
): { month: number; year: number; monthKey: string; fullFrench: string } {
  const now = new Date();
  const defaultMonth = now.getMonth() + 1; // 1-based
  const defaultYear = now.getFullYear();

  if (!input) {
    return {
      month: defaultMonth,
      year: defaultYear,
      monthKey: `${MONTHS[defaultMonth - 1]} ${defaultYear}`,
      fullFrench: `${MONTHS_FR[MONTHS[defaultMonth - 1]]} ${defaultYear}`,
    };
  }

  if (typeof input === "object") {
    const m = Math.min(Math.max(1, Number(input.month) || defaultMonth), 12);
    const y = Number(input.year) && Number(input.year) > 1900 ? Number(input.year) : defaultYear;
    return {
      month: m,
      year: y,
      monthKey: `${MONTHS[m - 1]} ${y}`,
      fullFrench: `${MONTHS_FR[MONTHS[m - 1]]} ${y}`,
    };
  }

  const raw = String(input).trim();
  if (!raw) {
    return {
      month: defaultMonth,
      year: defaultYear,
      monthKey: `${MONTHS[defaultMonth - 1]} ${defaultYear}`,
      fullFrench: `${MONTHS_FR[MONTHS[defaultMonth - 1]]} ${defaultYear}`,
    };
  }

  // 1. Check for ISO or numeric patterns: "2026-09", "2026-9", "9-2026", "09-2026", "9/2026"
  const isoMatch = raw.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = Math.min(Math.max(1, parseInt(isoMatch[2], 10)), 12);
    return {
      month: m,
      year: y,
      monthKey: `${MONTHS[m - 1]} ${y}`,
      fullFrench: `${MONTHS_FR[MONTHS[m - 1]]} ${y}`,
    };
  }

  const reverseIsoMatch = raw.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (reverseIsoMatch) {
    const m = Math.min(Math.max(1, parseInt(reverseIsoMatch[1], 10)), 12);
    const y = parseInt(reverseIsoMatch[2], 10);
    return {
      month: m,
      year: y,
      monthKey: `${MONTHS[m - 1]} ${y}`,
      fullFrench: `${MONTHS_FR[MONTHS[m - 1]]} ${y}`,
    };
  }

  // 2. Extract year (4-digit number)
  const yearMatch = raw.match(/\b(20\d\d|19\d\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : defaultYear;

  // 3. Normalize string for text matching
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove Latin diacritics
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove Arabic tashkeel / combining marks (hamza, fatha, etc.)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا") // normalize arabic alif
    .replace(/ة/g, "ه");

  // Month lookup dictionary
  const MONTH_DICT: Record<string, number> = {
    // English
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,

    // French (accent-free)
    janvier: 1, janv: 1,
    fevrier: 2, fevr: 2,
    mars_: 3,
    avril: 4, avr: 4,
    mai_: 5,
    juin_: 6,
    juillet: 7, juil: 7,
    aout: 8,
    septembre_: 9,
    octobre_: 10,
    novembre_: 11,
    decembre: 12,

    // Arabic (Standard & Tunisian / Maghrebi)
    "جانفي": 1, "يناير": 1,
    "فيفري": 2, "فبراير": 2,
    "مارس": 3,
    "افريل": 4, "ابريل": 4,
    "ماي": 5, "مايو": 5,
    "جوان": 6, "يونيو": 6,
    "جويليه": 7, "يوليو": 7,
    "اوت": 8, "اغسطس": 8,
    "سبتمبر": 9,
    "اكتوبر": 10,
    "نوفمبر": 11,
    "ديسمبر": 12,
  };

  // Find matching month token in the text
  let detectedMonth: number | undefined;
  const tokens = normalized.split(/[\s,._/-]+/);
  for (const token of tokens) {
    if (MONTH_DICT[token]) {
      detectedMonth = MONTH_DICT[token];
      break;
    }
    // Check partial prefix (e.g. "septembre" for "septembre")
    for (const [key, mNum] of Object.entries(MONTH_DICT)) {
      const cleanKey = key.replace(/_$/, "");
      if (token === cleanKey || (cleanKey.length >= 4 && token.startsWith(cleanKey))) {
        detectedMonth = mNum;
        break;
      }
    }
    if (detectedMonth) break;
  }

  const finalMonth = detectedMonth !== undefined ? detectedMonth : defaultMonth;
  const canonicalKey = `${MONTHS[finalMonth - 1]} ${year}`;
  const frKey = `${MONTHS_FR[MONTHS[finalMonth - 1]]} ${year}`;

  return {
    month: finalMonth,
    year,
    monthKey: canonicalKey,
    fullFrench: frKey,
  };
}
