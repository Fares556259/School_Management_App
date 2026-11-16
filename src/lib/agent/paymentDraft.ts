import prisma from '@/lib/prisma';
import type { ToolContext } from '@/lib/telegram/tools/readTools';
import { explicitCurrencyAmounts } from './purchaseDraft';
import { schoolMonth } from './dataAccuracy';
import { outputText } from './outputLanguage';

const DERJA_PAYMENT_VERB = '(?:(?:kh[aâe]?|5a|xa)l+[ae]?s(?:etna|itna|ni|na)?|خلّ?ص(?:تنا|نا|ني))';
export const PAYMENT_WORDS = new RegExp(DERJA_PAYMENT_VERB, 'iu');
const NAMED_PAYMENT = new RegExp(
  `^(.+?)\\s+(${DERJA_PAYMENT_VERB}|a\\s+(?:pay[ée]|r[ée]gl[ée])|paid(?:\\s+me)?)(?=\\s|$)([\\s\\S]*)$`,
  'iu',
);

/** A named payment statement becomes a real proposal, never a narrative claim or an inferred price. */
export async function getNamedPaymentDraft(message: string, context: ToolContext): Promise<{
  toolName?: 'record_payment' | 'record_parent_payment'; args?: Record<string, any>; beneficiary?: string; clarification?: string;
} | null> {
  if (/[?؟]\s*$/.test(message) || /^\s*(?:who|which|how|has |did |combien|qui |quels|quelles|montre|liste|affiche|هل|من |شكون)/i.test(message)) return null;
  const match = message.match(NAMED_PAYMENT);
  if (!match) return null;
  // Multi-service instructions need the typed payment tool, not tuition-only allocation.
  if (/(?:bus|transport|garde|inscription|registration|service|حضانة|نقل|تسجيل)/i.test(match[3])) return null;
  let query = match[1].trim();
  const requestedRole = /^(?:parent|weli|ولي)\s+/i.test(query) ? 'parent' : /^(?:élève|eleve|student|تلميذ)\s+/i.test(query) ? 'student' : undefined;
  query = query.replace(/^(?:parent|weli|ولي|élève|eleve|student|تلميذ)\s+/i, '');
  const classSuffix = query.match(/\s+(?:classe|class)\s+([\p{L}\p{N}-]+)$/iu);
  const className = classSuffix?.[1];
  if (classSuffix) query = query.slice(0, classSuffix.index).trim();
  const amounts = explicitCurrencyAmounts(match[3]);
  const remainder = match[3].replace(/\b(?:lyouma|lyoum|youma|today|aujourd'hui)\b|اليوم/gi, '').trim();
  if (!amounts.length && /^(?:b\s*)?-?\d+(?:[.,]\d+)?$/.test(remainder)) amounts.push(Number(remainder.replace(/^b\s*/, '').replace(',', '.')));
  if (amounts.length > 1 || (amounts.length === 1 && (!Number.isFinite(amounts[0]) || amounts[0] <= 0))) return { clarification: outputText(context.language, 'Précisez un seul montant reçu, strictement positif, en DT.', 'Specify one positive amount received in TND.', 'يرجى تحديد مبلغ مستلم واحد موجب بالدينار.') };
  const parts = query.split(/\s+/);
  const conditions: any[] = [{ id: query }, { username: { equals: query, mode: 'insensitive' } }];
  for (let i = 1; i < parts.length; i++) {
    const first = parts.slice(0, i).join(' '), last = parts.slice(i).join(' ');
    conditions.push({ name: { equals: first, mode: 'insensitive' }, surname: { equals: last, mode: 'insensitive' } }, { name: { equals: last, mode: 'insensitive' }, surname: { equals: first, mode: 'insensitive' } });
  }
  const select = { id: true, name: true, surname: true };
  const [students, parents] = await Promise.all([
    requestedRole === 'parent' ? [] : prisma.student.findMany({
      where: {
        schoolId: context.schoolId,
        OR: [...conditions, { nationalId: query }],
        ...(className ? { class: { name: { equals: className, mode: 'insensitive' } } } : {}),
      },
      select: { ...select, class: { select: { name: true } } },
      take: 3,
    }),
    requestedRole === 'student' || className ? [] : prisma.parent.findMany({ where: { schoolId: context.schoolId, OR: conditions }, select, take: 3 }),
  ]);
  const candidates = [...students.map(student => ({ ...student, role: 'student' })), ...parents.map(parent => ({ ...parent, role: 'parent' }))];
  if (candidates.length !== 1) return { clarification: candidates.length
    ? outputText(context.language, 'Plusieurs personnes correspondent. Reformulez par exemple : « Élève Prénom Nom classe 1A a payé 50 DT » ou « Parent Prénom Nom a payé 50 DT ». Si le nom reste ambigu, utilisez l’identifiant exact.', 'Several people match. Try “Student First Last class 1A paid 50 TND” or “Parent First Last paid 50 TND”. If the name is still ambiguous, use the exact identifier.', 'توجد عدة نتائج مطابقة. أعد كتابة الطلب مع تحديد «تلميذ» أو «ولي» قبل الاسم الكامل، وأضف معرّف الشخص عند الحاجة.')
    : outputText(context.language, 'Aucun élève ou parent ne correspond à ce nom exact dans votre école. Précisez son nom complet ou son identifiant.', 'No student or parent matches that exact name in your school. Provide the full name or identifier.', 'لم يُعثر على تلميذ أو ولي مطابق لهذا الاسم في مدرستكم. يرجى ذكر الاسم الكامل أو المعرّف.') };
  const person = candidates[0]; const period = schoolMonth();
  return { toolName: person.role === 'student' ? 'record_payment' : 'record_parent_payment',
    args: { [person.role === 'student' ? 'studentNameOrId' : 'parentNameOrId']: person.id, ...(amounts.length ? { amount: amounts[0] } : {}), month: period.month, year: period.year },
    beneficiary: `${person.name} ${person.surname}`.trim() + ('class' in person && (person as any).class?.name ? ` · ${(person as any).class.name}` : ''),
  };
}
