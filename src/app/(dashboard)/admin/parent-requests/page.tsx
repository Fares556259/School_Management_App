import { redirect } from 'next/navigation';
import { getParentAccessAdmin } from '@/lib/parentAccessAdmin';
import { getParentAccessInboxData } from '@/lib/parentAccessInbox';
import ParentAccessInbox from '@/components/ParentAccessInbox';
export const dynamic = 'force-dynamic';
export default async function ParentRequestsPage() {
  const admin = await getParentAccessAdmin();
  if (!admin) redirect('/sign-in');
  const initialData = await getParentAccessInboxData(admin.schoolId);
  return <ParentAccessInbox initialData={initialData} />;
}
