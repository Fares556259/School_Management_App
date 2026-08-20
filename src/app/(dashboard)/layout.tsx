import Menu from "@/components/Menu";
import Navbar from "@/components/Navbar";
import { getAuthenticatedUser } from "@/utils/supabase/server";
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
    academicYear: school?.Institution?.academicYear,
    currentSemester: school?.Institution?.currentSemester,
  };
});

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthenticatedUser();
  const userId = user?.id;

  if (!userId) {
    return redirect("/sign-in");
  }

  // Fetch all parallelizable dashboard data
  const [role, schoolConfigResult] = await Promise.all([
    getRole(),
    getSchoolConfig().catch((error) => {
      console.warn("⚠️ [LAYOUT] Delayed config fetch (Non-critical):", error.message);
      return null;
    })
  ]);
  const schoolConfig = schoolConfigResult;

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
      {/* LEFT SIDEBAR */}
      <aside className="w-16 md:w-20 lg:w-[260px] xl:w-[275px] shrink-0 p-3.5 lg:p-4 print:hidden z-30 sticky top-0 h-screen flex flex-col bg-white text-slate-800 border-r border-slate-200/80 shadow-xs transition-all duration-300">
        <div className="flex items-center justify-center lg:justify-between mb-6 px-1 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <Image 
              src={schoolConfig?.schoolLogo || "/logo.png"} 
              alt="logo" 
              width={32} 
              height={32} 
              className="w-8 h-8 object-contain rounded-lg border border-slate-200 shadow-xs bg-white shrink-0" 
            />
            <span className="hidden lg:block font-bold text-[15px] text-slate-900 tracking-tight truncate max-w-[170px]">
              {schoolConfig?.schoolName || "SnapSchool"}
            </span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
          <Menu role={role!} adminData={adminProfile} schoolConfig={schoolConfig} />
        </div>
      </aside>
      {/* RIGHT MAIN CONTENT */}
      <div className="flex-1 min-w-0 overflow-y-auto flex flex-col print:w-full print:p-0 print:bg-white print:overflow-visible print:h-auto print:block relative">
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
