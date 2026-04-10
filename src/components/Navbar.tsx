import { UserButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import Image from "next/image"
import { getAdminProfile } from "@/app/(dashboard)/admin/actions/profileActions";

const Navbar = async () => {
  const { userId, sessionClaims } = auth();
  
  // 1. EXTRACTION: Try fast claims first
  let role = (sessionClaims as any)?.metadata?.role as string | undefined;
  let fullName = (sessionClaims as any)?.fullName as string | undefined;

  // 2. FALLBACK: Fetch only if data is missing from session
  if (!fullName || !role) {
    try {
      const user = await currentUser();
      if (user) {
        fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
        role = role || (user.publicMetadata?.role as string | undefined);
      }
    } catch (err) {
      console.error("Clerk Navbar Fallback Error:", err);
    }
  }

  // Final defaults
  fullName = fullName || "User";
  
  let adminData = null;
  
  try {
    if (role === "admin") {
      const resp = await getAdminProfile();
      adminData = resp?.data;
    }
  } catch (err) {
    console.error("Error fetching admin data in Navbar:", err);
  }

  return (
    <div className='flex items-center justify-between p-6 bg-white/50 backdrop-blur-sm sticky top-0 z-50'>
      {/* SEARCH BAR */}
      <div className='hidden md:flex items-center gap-3 text-xs rounded-2xl bg-slate-100/80 border border-slate-200 px-4 py-2 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all group'>
        <Image src="/search.png" alt="" width={16} height={16} className="opacity-40 group-hover:opacity-100 transition-opacity"/>
        <input type="text" placeholder="Search for anything..." className="w-[240px] bg-transparent outline-none text-slate-600 placeholder:text-slate-400 font-medium"/>
      </div>
      {/* ICONS AND USER */}
      <div className='flex items-center gap-5 justify-end w-full'>
        <div className='bg-white border border-slate-100 shadow-sm rounded-xl w-10 h-10 flex items-center justify-center cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-all group'>
          <Image src="/message.png" alt="" width={20} height={20} className="group-hover:scale-110 transition-transform"/>
        </div>
        <div className='bg-white border border-slate-100 shadow-sm rounded-xl w-10 h-10 flex items-center justify-center cursor-pointer relative hover:bg-indigo-50 hover:text-indigo-600 transition-all group'>
          <Image src="/announcement.png" alt="" width={20} height={20} className="group-hover:scale-110 transition-transform"/>
          <div className='absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-indigo-500 text-white rounded-full text-[10px] font-bold border-2 border-white shadow-sm'>1</div>
        </div>
        <div className='h-8 w-[1px] bg-slate-200 mx-2 hidden sm:block'></div>
        <div className='flex items-center gap-3 pl-2'>
          <div className='flex flex-col text-right hidden sm:flex leading-tight'>
            <span className="text-sm font-black text-slate-800">
                {fullName}
            </span>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
              {role || "User"}
            </span>
          </div>
          {adminData?.img ? (
            <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-sm cursor-pointer hover:scale-105 transition-transform overflow-hidden">
               <Image src={adminData.img} alt="" width={38} height={38} className="rounded-full border-2 border-white object-cover w-[38px] h-[38px]"/>
            </div>
          ) : (
            <UserButton />
          )}
        </div>
      </div>
    </div>
  )
}

export default Navbar