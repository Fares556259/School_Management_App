import DashboardSkeleton from "./components/DashboardSkeleton";

// This file is automatically shown by Next.js App Router while the admin page
// is rendering (e.g. on first load or cache miss). It renders instantly from
// the edge, giving the user immediate visual feedback with no blank white flash.
export default function AdminLoading() {
  return (
    <div className="p-4 md:p-6">
      <div className="h-8 w-24 bg-slate-100 rounded mb-6 animate-pulse" />
      <DashboardSkeleton />
    </div>
  );
}
