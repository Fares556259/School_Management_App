export default function StudentProfileLoading() {
  return (
    <div className="flex-1 p-4 lg:p-6 flex flex-col gap-6 max-w-[1600px] mx-auto w-full animate-pulse">
      {/* Breadcrumb Skeleton */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-24 bg-slate-200 rounded-md" />
          <div className="h-5 w-4 bg-slate-100 rounded" />
          <div className="h-5 w-36 bg-slate-200 rounded-md" />
          <div className="h-5 w-16 bg-slate-100 rounded-full" />
        </div>
        <div className="h-8 w-28 bg-slate-100 rounded-xl" />
      </div>

      {/* Profile Card Skeleton */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-200 shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-8 w-48 bg-slate-200 rounded-lg" />
            <div className="h-4 w-32 bg-slate-100 rounded-md" />
            <div className="flex gap-2 mt-1">
              <div className="h-6 w-24 bg-slate-100 rounded-lg" />
              <div className="h-6 w-20 bg-slate-100 rounded-lg" />
            </div>
          </div>
          <div className="h-14 w-36 bg-slate-100 rounded-xl hidden md:block shrink-0" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs h-24" />
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm h-96" />
    </div>
  );
}
