import SuperadminMenu from "@/components/SuperadminMenu";
import Navbar from "@/components/Navbar";
import { auth } from "@clerk/nextjs/server";
import { getRole } from "@/lib/role";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageTransition from "@/components/PageTransition";

export default async function SuperadminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  const role = await getRole();
  
  if (role !== "superadmin") {
    return redirect("/admin");
  }

  return (
    <div className="h-screen flex text-slate-900 print:h-auto print:block">
      {/* LEFT */}
      <div className="w-[14%] md:w-[8%] lg:w-[16%] xl:w-[14%] p-4 print:hidden border-r border-slate-100 bg-white shadow-sm z-30 sticky top-0 h-screen flex flex-col">
        <Link
          href="/superadmin"
          className="flex items-center justify-center lg:justify-start gap-2 px-2 mb-6 shrink-0"
        >
          <div className="p-1.5 bg-indigo-600 rounded-lg shadow-sm">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white w-5 h-5"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
          </div>
          <div className="hidden lg:flex flex-col -space-y-1">
            <span className="font-black text-lg tracking-tighter text-slate-800">
               SnapSchool
            </span>
            <span className="text-[9px] font-black tracking-widest uppercase text-indigo-500">Platform Admin</span>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
          <SuperadminMenu />
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-[86%] md:w-[92%] lg:w-[84%] xl:w-[86%] bg-[#F7F8FA] overflow-scroll flex flex-col print:w-full print:p-0 print:bg-white print:overflow-visible print:h-auto print:block relative">
        <div className="print:hidden sticky top-0 bg-[#F7F8FA]/80 backdrop-blur-md z-20">
          <Navbar />
        </div>
        <PageTransition>
          <div className="p-4 md:p-6 lg:p-8 print:p-0 print:m-0">
            {children}
          </div>
        </PageTransition>
      </div>
    </div>
  );
}
