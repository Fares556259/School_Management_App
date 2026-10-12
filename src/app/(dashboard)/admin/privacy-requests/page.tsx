import Link from 'next/link';
import { AlertTriangle, Bot, ChevronRight, Clock3, FileClock, ShieldCheck, Trash2 } from 'lucide-react';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { getSchoolId } from '@/lib/school';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type RequestDetails = { status?: string; role?: string; message?: string };

function readDetails(value: unknown): RequestDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const data = value as Record<string, unknown>;
  return {
    status: typeof data.status === 'string' ? data.status : undefined,
    role: typeof data.role === 'string' ? data.role : undefined,
    message: typeof data.message === 'string' ? data.message : undefined,
  };
}

const roleLabels: Record<string, string> = {
  parent: 'Parent',
  teacher: 'Enseignant',
  admin: 'Administrateur',
};

export default async function PrivacyRequests() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/sign-in');

  const schoolId = await getSchoolId();
  const admin = await prisma.admin.findFirst({
    where: { id: user.id, schoolId, status: 'active' },
    select: { id: true },
  });
  if (!admin) redirect('/sign-in');

  const entries = await prisma.auditLog.findMany({
    where: { schoolId, entityType: 'PrivacyRequest' },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });
  const openCount = entries.filter((entry) => readDetails(entry.newValues).status === 'OPEN').length;
  const deletionCount = entries.filter((entry) => entry.action === 'ACCOUNT_DELETION').length;
  const reportCount = entries.filter((entry) => entry.action === 'AI_REPORT').length;

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Conformité et sécurité</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900">Demandes de confidentialité</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
            Suivez les demandes de suppression de compte et les signalements liés à Hnia depuis un espace clair et réservé à votre école.
          </p>
        </div>
        <Link href="/admin/audit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900 shadow-sm transition hover:border-brand-300 hover:text-brand-700">
          <FileClock size={17} /> Journal d’audit <ChevronRight size={16} />
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Résumé des demandes">
        {[
          { label: 'À traiter', value: openCount, icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
          { label: 'Suppressions', value: deletionCount, icon: Trash2, tone: 'text-rose-700 bg-rose-50' },
          { label: 'Signalements Hnia', value: reportCount, icon: Bot, tone: 'text-brand-600 bg-brand-50' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="ss-panel flex items-center justify-between p-5">
            <div><p className="text-sm text-ink-500">{label}</p><p className="mt-1 text-3xl font-semibold text-ink-900">{value}</p></div>
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span>
          </div>
        ))}
      </section>

      <aside className="flex gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 text-sm leading-6 text-ink-900">
        <ShieldCheck className="mt-0.5 shrink-0 text-brand-600" size={20} />
        <p><strong>Traitement sécurisé.</strong> Vérifiez l’identité et les obligations de conservation avant toute suppression. Les dossiers scolaires d’autres personnes ne doivent jamais être supprimés. Les 100 demandes les plus récentes sont affichées ici.</p>
      </aside>

      <section className="space-y-3" aria-label="Demandes récentes">
        {entries.length === 0 ? (
          <div className="ss-panel grid min-h-56 place-items-center p-8 text-center">
            <div><ShieldCheck className="mx-auto mb-3 text-emerald-600" size={34} /><h2 className="font-semibold text-ink-900">Aucune demande en attente</h2><p className="mt-1 text-sm text-ink-500">Les nouvelles demandes apparaîtront automatiquement ici.</p></div>
          </div>
        ) : entries.map((entry) => {
          const details = readDetails(entry.newValues);
          const isDeletion = entry.action === 'ACCOUNT_DELETION';
          const Icon = isDeletion ? Trash2 : AlertTriangle;
          return (
            <article key={entry.id} className="ss-panel overflow-hidden">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${isDeletion ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}><Icon size={20} /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-ink-900">{isDeletion ? 'Suppression de compte' : 'Signalement Hnia'}</h2>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{details.status === 'OPEN' ? 'À traiter' : details.status || 'Reçue'}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-500">
                      Référence #{entry.id} · {entry.timestamp.toLocaleString('fr-FR', { timeZone: 'Africa/Tunis', dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {details.message ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-900">{details.message}</p> : <p className="mt-3 text-sm italic text-ink-500">Aucun commentaire ajouté.</p>}
                  </div>
                </div>
                <div className="shrink-0 rounded-xl bg-paper px-3 py-2 text-xs text-ink-500">
                  <span className="font-semibold text-ink-900">{roleLabels[details.role || ''] || 'Compte'}</span><br />
                  <span className="font-mono">{entry.entityId}</span>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
