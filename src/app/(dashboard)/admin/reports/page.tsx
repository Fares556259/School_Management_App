import { Mail, ShieldCheck } from "lucide-react";

export default function ReportsManagementPage() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-[16px] border border-[#dddddd] bg-white p-8 shadow-sm">
      <div className="max-w-xl text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Mail size={26} />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Daily reports are being upgraded</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Email reports are temporarily paused while recipient lists are migrated to strict school ownership.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
          <ShieldCheck size={16} /> School data remains isolated
        </div>
      </div>
    </div>
  );
}
