import Menu from "@/components/Menu";
import Navbar from "@/components/Navbar";
import { auth } from "@clerk/nextjs/server";
import { getRole } from "@/lib/role";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageTransition from "@/components/PageTransition";
import prisma from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  const role = await getRole();
  const schoolConfig = await prisma.schoolConfig.findFirst({ where: { id: 1 } });

  return (
    <div className="h-screen flex text-slate-900 print:h-auto print:block">
      {/* LEFT */}
      <div className="w-[14%] md:w-[8%] lg:w-[16%] xl:w-[14%] p-4 print:hidden border-r border-slate-100 bg-white shadow-sm z-30 sticky top-0 h-screen flex flex-col">
        <Link
          href="/"
          className="flex items-center justify-center lg:justify-start gap-2 px-2 mb-6 shrink-0"
        >
          <Image src={schoolConfig?.schoolLogo || "/logo.png"} alt="logo" width={32} height={32} className="w-8 h-8 object-contain" />
          <span className="hidden lg:block font-black text-xl tracking-tighter text-indigo-600 truncate">
             {schoolConfig?.schoolName || "SnapSchool"}
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
          <Menu role={role!} />
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
