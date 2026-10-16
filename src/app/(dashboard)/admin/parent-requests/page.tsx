import { redirect } from 'next/navigation';
import { getParentAccessAdmin } from '@/lib/parentAccessAdmin';
import ParentAccessInbox from '@/components/ParentAccessInbox';
export const dynamic = 'force-dynamic';
export default async function ParentRequestsPage() {
  if (!await getParentAccessAdmin()) redirect('/sign-in');
  return <ParentAccessInbox />;
}
