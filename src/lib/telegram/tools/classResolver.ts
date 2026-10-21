import prisma from "@/lib/prisma";

export function normalizeClassName(value: string) {
  const ordinals: Record<string,string> = { 'أولى':'1', 'الاولى':'1', 'اولى':'1', 'ثانية':'2', 'الثانية':'2', 'ثانيه':'2', 'ثالثة':'3', 'الثالثة':'3', 'ثالثه':'3', 'رابعة':'4', 'الرابعة':'4', 'رابعه':'4', 'خامسة':'5', 'الخامسة':'5', 'سادسة':'6', 'السادسة':'6', 'سابعة':'7', 'السابعة':'7', 'ثامنة':'8', 'الثامنة':'8', 'تاسعة':'9', 'التاسعة':'9' };
  const letters: Record<string,string> = { 'أ':'a', 'ا':'a', 'ب':'b', 'ج':'c', 'د':'d', 'ه':'e' };
  return value.trim().toLowerCase()
    .replace(/(?:^|\s)(?:classe|class|salle|room|سنة|صف|قسم|كلاس)(?=\s|$)/gi, ' ')
    .split(/\s+/).map(word => ordinals[word] || letters[word] || word).join('')
    .replace(/(\d+)(?:ère|ere|er|ème|eme|ieme|e)(?=[a-z]|$)/gi,'$1')
    .replace(/[^a-z0-9\u0600-\u06ff]/g,'');
}

/** Exact normalized matches win; ambiguous partial names must never select an arbitrary class. */
export async function resolveClassByName(schoolId: string, rawQuery?: string | null) {
  if (!rawQuery?.trim() || !schoolId) return null;
  const query = normalizeClassName(rawQuery);
  if (!query) return null;
  const classes = await prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true, capacity: true, supervisorId: true, levelId: true, schoolId: true } });
  const exact = classes.filter(c => normalizeClassName(c.name) === query);
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  // A complete code such as 1A must not match 11A or 1AB.
  if (/^\d+[a-z]$/.test(query)) return null;
  const candidates = classes.filter(c => normalizeClassName(c.name).includes(query));
  return candidates.length === 1 ? candidates[0] : null;
}
