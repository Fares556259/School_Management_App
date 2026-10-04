import prisma from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { getSchoolId } from '@/lib/school';
import { redirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function PrivacyRequests() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/sign-in');
  const schoolId=await getSchoolId();
  const admin = await prisma.admin.findFirst({where:{id:user.id,schoolId,status:'active'},select:{id:true}});
  if (!admin) redirect('/sign-in');
  const entries=await prisma.auditLog.findMany({where:{schoolId,entityType:'PrivacyRequest'},orderBy:{timestamp:'desc'},take:100});
  return <main className="p-6 space-y-6"><h1 className="text-2xl font-bold">Demandes de confidentialité et signalements Hnia</h1>
    <p>Vérifiez régulièrement cette boîte. Pour chaque demande de suppression : vérifiez l’identité, examinez les données liées et les obligations de conservation, supprimez/anonymisez les données non nécessaires, révoquez l’accès puis confirmez le résultat au demandeur. Ne supprimez pas les dossiers scolaires d’autres personnes. Pour Hnia : examinez le signalement et corrigez les protections ou le contenu concerné.</p>
    <p>Les 100 demandes les plus récentes sont affichées. L’historique complet est disponible dans le journal d’audit (recherche : PrivacyRequest).</p>
    {entries.length===0 ? <p>Aucune demande.</p> : entries.map(entry=><article key={entry.id} className="bg-white border rounded-lg p-5 space-y-2">
      <h2 className="font-semibold">#{entry.id} — {entry.action==='ACCOUNT_DELETION'?'Suppression de compte':'Signalement Hnia'}</h2>
      <p>{entry.timestamp.toLocaleString('fr-FR')} · Compte : {entry.entityId}</p>
      <pre className="whitespace-pre-wrap break-words text-sm">{JSON.stringify(entry.newValues,null,2)}</pre>
    </article>)}
    <a className="text-blue-700 underline" href="/admin/audit">Journal d’audit</a>
  </main>;
}
