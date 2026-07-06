import Menu from "@/components/Menu";
import Navbar from "@/components/Navbar";
import { createClient } from "@/utils/supabase/server";
import { getRole } from "@/lib/role";
import { getSchoolId } from "@/lib/school";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageTransition from "@/components/PageTransition";
import prisma from "@/lib/prisma";
import { cache } from "react";
import { getAdminProfile } from "@/app/(dashboard)/admin/actions/profileActions";

// Request-level caching for school configuration
const getSchoolConfig = cache(async () => {
  const schoolId = await getSchoolId();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { Institution: true }
  });
  return {
    schoolName: school?.Institution?.schoolName,
    schoolLogo: school?.Institution?.schoolLogo,
    status: school?.status,
  };
});

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    return redirect("/sign-in");
  }

  const role = await getRole();
  
  // Fetch school configuration with request-level caching
  let schoolConfig = null;
  try {
    schoolConfig = await getSchoolConfig();
  } catch (error) {
    console.warn("⚠️ [LAYOUT] Delayed config fetch (Non-critical):", (error as any).message);
  }

  if (schoolConfig?.status === "SUSPENDED" && role !== "superadmin") {
    return redirect("/suspended");
  }
  
  // Fetch admin profile so the Menu and Navbar can display the custom photo and name
  let adminProfile = null;
  if (role === "admin") {
    try {
      const res = await getAdminProfile();
      if (res.data) adminProfile = res.data;
    } catch (error) {
      console.warn("⚠️ [LAYOUT] Failed to fetch admin profile:", (error as any).message);
    }
  }

  return (
    <div className="h-screen flex text-slate-900 print:h-auto print:block bg-[#F5F6F8]">
      {/* LEFT */}
      <div className="w-[14%] md:w-[8%] lg:w-[16%] xl:w-[14%] p-4 print:hidden z-30 sticky top-0 h-screen flex flex-col bg-[#1e3a5f] text-white">
        <div className="flex items-center justify-center lg:justify-between mb-8 px-2 shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <Image src={schoolConfig?.schoolLogo || "/logo.png"} alt="logo" width={28} height={28} className="w-7 h-7 object-contain rounded-md border border-white/10 shadow-sm bg-white" />
            <span className="hidden lg:block font-semibold text-[15px] text-white tracking-tight truncate max-w-[120px]">{schoolConfig?.schoolName || "SnapSchool"}</span>
          </Link>
          <div className="hidden lg:flex w-5 h-5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all rounded items-center justify-center cursor-pointer text-white/70 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></svg>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
          <Menu role={role!} adminData={adminProfile} />
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-[86%] md:w-[92%] lg:w-[84%] xl:w-[86%] overflow-scroll flex flex-col print:w-full print:p-0 print:bg-white print:overflow-visible print:h-auto print:block relative">
        <div className="print:hidden sticky top-0 bg-[#F5F6F8]/80 backdrop-blur-md z-20">
          <Navbar adminData={adminProfile} role={role!} />
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
