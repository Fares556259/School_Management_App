import { createClient } from "@/utils/supabase/server";
import { getRole } from "@/lib/role";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageTransition from "@/components/PageTransition";
import { LogOut } from "lucide-react";
import SuperadminTabs from "./superadmin/SuperadminTabs";

export default async function SuperadminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/sign-in");

  const role = await getRole();
  if (role !== "superadmin") return redirect("/admin");

  const initials = (user.email ?? "U")[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col print:bg-white">
      {/* ── Top bar ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 print:hidden">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center gap-6">
          {/* Logo */}
          <Link
            href="/superadmin"
            className="flex items-center gap-2 shrink-0"
          >
            <div className="p-1.5 bg-indigo-600 rounded-lg shadow-sm shadow-indigo-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <path d="m12 14 4-4" />
                <path d="M3.34 19a10 10 0 1 1 17.32 0" />
              </svg>
            </div>
            <span className="font-black text-lg tracking-tighter text-slate-800">SnapSchool</span>
          </Link>

          {/* Divider */}
          <div className="h-5 w-px bg-slate-200 shrink-0" />

          {/* Navigation Tabs */}
          <SuperadminTabs />

          {/* Spacer */}
          <div className="flex-1" />

          {/* User + sign out */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-700">
                {user.email}
              </span>
              <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">
                Superadmin
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
              {initials}
            </div>
            <Link
              href="/logout"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
              title="Sign out"
            >
              <LogOut size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1">
        <PageTransition>
          <div className="max-w-screen-xl mx-auto px-6 py-8 print:p-0">
            {children}
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
