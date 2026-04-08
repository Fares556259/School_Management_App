import { getAdminProfile } from "../admin/actions/profileActions";
import ProfileClient from "./ProfileClient";
import { redirect } from "next/navigation";
import { getRole } from "@/lib/role";

export default async function ProfilePage() {
  const role = await getRole();
  
  if (role !== "admin") {
    // For now, we only support admin profile customization in this refined view
    // Others could be added here later
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mb-6 border border-amber-100">
          <span className="text-3xl text-amber-500">🔒</span>
        </div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tighter mb-2">Access Restricted</h1>
        <p className="text-slate-500 max-w-md mx-auto font-medium">
          Profile customization is currently optimized for administrators. 
          Please contact your technical department for staff or teacher profile changes.
        </p>
      </div>
    );
  }

  const { data: adminProfile, error: profileError } = await getAdminProfile();

  if (!adminProfile) {
    return (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-6 border border-rose-100">
                <span className="text-3xl">❌</span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tighter mb-2">Profile Load Failure</h1>
            <p className="text-slate-500 max-w-md mx-auto font-medium">
                {profileError || "We encountered an error while retrieving your profile details."}
            </p>
        </div>
    );
  }

  return (
    <div className="bg-[#F7F8FA] min-h-screen">
       <ProfileClient initialData={adminProfile} />
    </div>
  );
}
