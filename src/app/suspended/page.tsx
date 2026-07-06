import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function SuspendedPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-sm border border-slate-100 p-8 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
          <ShieldAlert size={32} />
        </div>
        
        <h1 className="text-2xl font-black text-slate-800">Account Suspended</h1>
        
        <p className="text-sm text-slate-500 font-medium leading-relaxed">
          Your school's access to SnapSchool has been temporarily suspended. Please contact the platform administrator to resolve this issue and restore access.
        </p>

        <div className="mt-4 pt-6 border-t border-slate-100 w-full flex flex-col gap-3">
          <Link 
            href="/logout"
            className="w-full py-2.5 px-4 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors"
          >
            Sign Out
          </Link>
          <a 
            href="mailto:support@snapschool.io"
            className="w-full py-2.5 px-4 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
