/** Tunisia's school calendar is UTC+1, independent of the server's timezone. */
export function schoolDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function schoolDayRange(value = schoolDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date invalide : utilisez AAAA-MM-JJ.');
  const start = new Date(`${value}T00:00:00+01:00`);
  if (!Number.isFinite(start.getTime()) || schoolDate(start) !== value) throw new Error('Date invalide.');
  return { gte: start, lt: new Date(start.getTime() + 86400000) };
}
export function schoolMonth(month?: number, year?: number, now = new Date()) {
  const [currentYear, currentMonth] = schoolDate(now).split('-').map(Number);
  const m = month ?? currentMonth; const y = year ?? currentYear;
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 1900 || y > 9999) throw new Error('Mois ou année invalide.');
  const start = schoolDayRange(`${y}-${String(m).padStart(2, '0')}-01`).gte;
  const next = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2, '0')}-01`;
  return { month: m, year: y, range: { gte: start, lt: schoolDayRange(next).gte } };
}
export const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 1000) / 1000;
export function tuitionBalance(student: { customTuition?: number | null; level?: { tuitionFee?: number | null } | null }, payment?: any) {
  const fee = student.customTuition ?? student.level?.tuitionFee ?? 450;
  const received = payment && ['PAID', 'PARTIAL'].includes(payment.status) ? payment.amount : 0;
  const due = payment?.status === 'PAID' ? 0 : payment?.status === 'PARTIAL'
    ? (payment.deferredAmount ?? Math.max(0, fee - received))
    : payment ? (payment.deferredAmount ?? payment.amount ?? fee) : fee;
  return { fee, received: roundMoney(received), due: roundMoney(Math.max(0, due)) };
}
export function isVerificationFollowup(message: string) {
  return /^(?:u sure|are you sure|you sure|tu es s[uû]r(?:e)?|t'es s[uû]r(?:e)?|s[uû]r(?:e)?|v[ée]rifie(?: encore)?|recheck|confirm the list|c'est tout|that's all|khw hedhou?m(?: eli ya[9q]raw)?|khw hedhom eli ya9raw|متأكد|متاك[دذ]|هاذم الكل)[\s?!.]*$/i.test(message.trim());
}
export function isNextPage(message: string) {
  return /^(?:la suite|suite|suivant(?:e)?|page suivante|next(?: page)?|continue la liste|كمل|البقية)[\s?!.]*$/i.test(message.trim());
}
export function needsFreshSchoolData(message: string) {
  if (/^(?:who are you|what(?:'s| is) your name|qui es[- ]tu|chnwa esm(?:e)?k(?: enti)?)[\s?!.]*$/i.test(message.trim())) return false;
  if (/(?:9ad+eh|kadeh|ch7al|قداش)/i.test(message)) return true;
  if (/^(?:comment |how to |how do |kifech )/i.test(message.trim())) return false;
  return /(?:combien|liste|effectif|qui |who |how many|how much|chkoun|chkoune|chkon|ya[9q]raw|شكون|قداش|payment|paiement|payé|impayé|recettes|revenus|dépenses|caisse|attendance|absences|students|élèves|statistique|emploi du temps|planning|moyenne|notes|classe|enseignant|parent|statut|salaire|paie|devoir|résultat|donn[ée]es)/i.test(message);
}
