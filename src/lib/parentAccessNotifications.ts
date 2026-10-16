import prisma from './prisma';
import { sendDirectPushTokens } from './notifications';

export function accessDecisionMessage(locale: string, action: string, reference: string) {
  const messages = {
    fr: {
      APPROVE: ['Votre compte est activé', `L’école a approuvé votre accès (${reference}). Connectez-vous avec votre numéro et votre mot de passe.`],
      REJECT: ['Votre demande a été examinée', `Votre demande (${reference}) nécessite une correction. Ouvrez l’application pour consulter le motif.`],
      REVOKE: ['Accès mis à jour', `L’école a retiré cet accès (${reference}). Contactez l’établissement pour en savoir plus.`],
    },
    en: {
      APPROVE: ['Your account is activated', `The school approved your access (${reference}). Sign in with your phone number and password.`],
      REJECT: ['Your request has been reviewed', `Your request (${reference}) needs a correction. Open the app to see the reason.`],
      REVOKE: ['Access updated', `The school removed this access (${reference}). Contact the school for assistance.`],
    },
    ar: {
      APPROVE: ['تم تفعيل حسابك', `وافقت المدرسة على طلبك (${reference}). ادخل برقم هاتفك وكلمة المرور التي اخترتها.`],
      REJECT: ['تمت مراجعة طلبك', `يحتاج طلبك (${reference}) إلى تصحيح. افتح التطبيق للاطلاع على السبب.`],
      REVOKE: ['تم تحديث صلاحيات الدخول', `ألغت المدرسة هذا الربط (${reference}). اتصل بالإدارة للاستفسار.`],
    },
  };
  return (messages[locale as keyof typeof messages] || messages.fr)[action as 'APPROVE' | 'REJECT' | 'REVOKE'];
}

/** Claimed with a lease, retried by cron and when a device registers. At-least-once delivery. */
export async function flushAccessNotifications(parentId?: string) {
  const deliveries = await prisma.parentAccessDelivery.findMany({
    where: { ...(parentId ? { parentId } : {}), status: 'PENDING', parent: { expoPushToken: { not: null } }, nextAttemptAt: { lte: new Date() }, attempts: { lt: 6 } },
    orderBy: { createdAt: 'asc' }, take: 50,
    include: { parent: { select: { expoPushToken: true } } },
  });
  const decisions = deliveries.length ? await prisma.parentAccessRequest.findMany({
    where: { id: { in: deliveries.map(item => item.requestId) } },
    select: {
      id: true,
      status: true,
      studentId: true,
      reviewedAt: true,
      student: { select: { nationalId: true, name: true, surname: true, img: true, class: { select: { name: true } } } },
    },
  }) : [];
  const decisionsById = new Map(decisions.map(decision => [decision.id, decision]));
  for (const item of deliveries) {
    if (!item.parent.expoPushToken) continue; // Keep it queued until permissions/device registration.
    const leased = await prisma.parentAccessDelivery.updateMany({
      where: { id: item.id, status: 'PENDING', nextAttemptAt: { lte: new Date() } },
      data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 5 * 60_000) },
    });
    if (!leased.count) continue;
    try {
      const decision = decisionsById.get(item.requestId);
      const approved = decision?.status === 'APPROVED';
      const result = await sendDirectPushTokens([item.parent.expoPushToken], item.title, item.message, {
        data: {
          type: 'PARENT_ACCESS',
          id: item.notificationId,
          screen: 'ParentApproval',
          requestId: item.requestId,
          status: decision?.status,
          reference: `••••${(decision?.student.nationalId || '').slice(-4)}`,
          studentId: approved ? decision?.studentId : undefined,
          child: approved ? {
            id: decision?.studentId,
            name: decision?.student.name,
            surname: decision?.student.surname,
            className: decision?.student.class?.name || null,
            img: decision?.student.img,
          } : undefined,
          reviewedAt: decision?.reviewedAt?.toISOString(),
        },
      });
      if (result.success) await prisma.parentAccessDelivery.update({ where: { id: item.id }, data: { status: 'SENT' } });
    } catch (error) {
      console.error('[Parent access notification retry]', item.id, error);
    }
  }
}
