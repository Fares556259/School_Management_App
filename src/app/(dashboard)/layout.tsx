import Menu from "@/components/Menu";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import { getRole } from "@/lib/role";
import { getSchoolId } from "@/lib/school";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageTransition from "@/components/PageTransition";
import DashboardShellClient from "@/components/DashboardShellClient";
import prisma from "@/lib/prisma";
import { getAdminProfile } from "@/app/(dashboard)/admin/actions/profileActions";
import { getCachedTenantData } from "@/lib/cache";
import QueryProvider from "@/providers/QueryProvider";

// Multi-tenant caching for school configuration (1 hour TTL)
const getSchoolConfig = async (schoolId: string) => {
  return getCachedTenantData(
    schoolId,
    'institution',
    ['schoolConfig'],
    async () => {
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        include: { Institution: true },
      });
      return {
        schoolName: school?.Institution?.schoolName || school?.name,
        schoolSubdomain: school?.subdomain,
        schoolLogo: school?.Institution?.schoolLogo,
        status: school?.status,
        academicYear: school?.Institution?.academicYear,
        currentSemester: school?.Institution?.currentSemester,
      };
    },
    3600
  );
};

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

  // Resolve role and schoolId in parallel (from session/metadata fast path)
  const [role, schoolId] = await Promise.all([
    getRole(),
    getSchoolId(),
  ]);

  // Fetch schoolConfig and adminProfile in parallel with tenant cache (0ms on subsequent clicks)
  const [schoolConfigResult, adminProfileResult] = await Promise.all([
    getSchoolConfig(schoolId).catch((error) => {
      console.warn("⚠️ [LAYOUT] Delayed config fetch (Non-critical):", error.message);
      return null;
    }),
    role === "admin" && userId
      ? getCachedTenantData(
          schoolId,
          'staff',
          ['adminProfile', userId],
          async () => {
            const res = await getAdminProfile();
            return res.data;
          },
          3600
        ).catch((error) => {
          console.warn("⚠️ [LAYOUT] Failed to fetch admin profile:", error.message);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const schoolConfig = schoolConfigResult;
  const adminProfile = adminProfileResult;

  return (
    <QueryProvider>
      <div className="ss-app flex h-screen bg-paper text-ink-900 print:block print:h-auto">
        {/* LEFT SIDEBAR — hidden on mobile, visible md+ */}
        <aside className="ss-sidebar sticky top-0 z-30 hidden h-screen w-20 shrink-0 flex-col border-e border-ink-200 bg-white p-3.5 text-ink-800 transition-all duration-300 md:flex lg:w-[260px] lg:p-4 xl:w-[275px] print:hidden">
          <div className="flex items-center justify-center lg:justify-between mb-6 px-1 shrink-0">
            <Link
              href={role === "superadmin" || role === "superuser" ? "/superadmin" : (role ? `/${role}` : "/")}
              prefetch={true}
              className="flex items-center gap-2.5 min-w-0"
            >
              <Image
                src={schoolConfig?.schoolLogo || "/logo.png"}
                alt={schoolConfig?.schoolName ? `${schoolConfig.schoolName} logo` : "SnapSchool logo"}
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 rounded-control border border-ink-200 bg-white object-contain"
              />
              <span className="hidden max-w-[170px] truncate text-[15px] font-semibold tracking-tight text-ink-900 lg:block">
                {schoolConfig?.schoolName || "SnapSchool"}
              </span>
            </Link>
          </div>
          <div className="custom-scrollbar -me-1 flex-1 overflow-y-auto pe-1">
            <Menu role={role!} adminData={adminProfile} schoolConfig={schoolConfig} />
          </div>
        </aside>

        {/* RIGHT MAIN CONTENT */}
        <div className="flex-1 min-w-0 overflow-y-auto flex flex-col print:w-full print:p-0 print:bg-white print:overflow-visible print:h-auto print:block relative">
          {/* DashboardShellClient owns mobile drawer state + wires hamburger → drawer */}
          <DashboardShellClient role={role!} adminData={adminProfile} schoolConfig={schoolConfig}>
            <PageTransition>
              <div className="ss-page-content p-3 md:p-6 lg:p-8 print:m-0 print:p-0">
                {children}
              </div>
            </PageTransition>
          </DashboardShellClient>
        </div>
      </div>
    </QueryProvider>
  );
}
