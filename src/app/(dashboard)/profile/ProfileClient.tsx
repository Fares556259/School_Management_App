"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { updateAdminProfile } from "../admin/actions/profileActions";
import { User, Mail, Phone, Camera, Check, AlertCircle, UploadCloud } from "lucide-react";

interface ProfileClientProps {
  initialData: any;
}

const ProfileClient = ({ initialData }: ProfileClientProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Track the data currently saved on server to detect changes
  const [serverData, setServerData] = useState(initialData);

  const [name, setName] = useState(initialData?.name || "");
  const [surname, setSurname] = useState(initialData?.surname || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [img, setImg] = useState(initialData?.img || "/noAvatar.png");

  const hasChanges = 
    name !== (serverData?.name || "") ||
    surname !== (serverData?.surname || "") ||
    email !== (serverData?.email || "") ||
    phone !== (serverData?.phone || "");

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const payload = {
        name,
        surname,
        email,
        phone,
        img: img !== "/noAvatar.png" ? img : null,
      };
      
      const res = await updateAdminProfile(payload);

      if (res.success) {
        setSuccess(true);
        setServerData({ ...serverData, ...payload });
        router.refresh(); // Sync header and sidebar immediately
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(res.error || "Failed to update profile.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingImage(true);
    setError("");
    
    try {
      const supabase = (await import('@/utils/supabase/client')).createClient();
      const fileName = `profile-${initialData?.id || 'admin'}-${Date.now()}`;
      const filePath = `profiles/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      setImg(publicUrl);
      
      // Auto-save the profile with the new image
      const res = await updateAdminProfile({ img: publicUrl });
      if (res.success) {
        setServerData(prev => ({ ...prev, img: publicUrl }));
        router.refresh();
      } else {
        throw new Error(res.error || "Failed to save profile picture");
      }
    } catch (err: any) {
      console.error("Profile upload failed:", err);
      setError(err.message || "Failed to upload profile image.");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 flex-1 bg-white rounded-[16px] border border-[#dddddd] shadow-sm p-6 lg:p-10 m-4">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full mb-4 border-b border-[#dddddd] pb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
            <User size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-semibold text-[#181d26] leading-none tracking-tight mb-2">Profile Settings</h1>
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#5a5a5a]">
              <span>Manage your personal information and preferences</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {success && (
            <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-[6px] border border-emerald-200/50 text-[12px] font-bold tracking-wide">
              <Check size={14} /> Saved
            </div>
          )}
          <button 
            onClick={handleSave}
            disabled={!hasChanges || loading}
            className="px-4 py-2.5 rounded-[6px] bg-[#181d26] text-white hover:bg-[#0d1218] border border-transparent font-medium text-[13px] active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-3 rounded-[8px] border border-rose-200 text-[13px] font-medium">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-10">
        
        {/* LEFT CARD: IDENTITY (Avatar) */}
        <div className="flex flex-col gap-5 md:w-64 shrink-0">
          <div className="bg-[#f8fafc] border border-[#dddddd] rounded-[8px] p-6 flex flex-col items-center text-center">
            <div className="relative mb-4 group">
              <div className="w-28 h-28 rounded-full overflow-hidden border border-[#dddddd] bg-white shadow-sm relative">
                <Image 
                  src={img} 
                  alt="Avatar" 
                  fill 
                  className={`object-cover transition-opacity ${uploadingImage ? 'opacity-50' : 'opacity-100'}`}
                />
                {uploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full"></div>
                  </div>
                )}
              </div>
            </div>

            <h2 className="text-[16px] font-semibold text-[#181d26]">
              {name || surname ? `${name} ${surname}` : initialData?.username}
            </h2>
            <p className="text-[12px] font-medium text-[#5a5a5a] uppercase tracking-wider mt-1">Administrator</p>
            
            <div className="w-full h-px bg-[#dddddd] my-5"></div>
            
            <input
              type="file"
              id="avatar-upload"
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploadingImage}
            />
            <button 
              onClick={() => document.getElementById('avatar-upload')?.click()}
              disabled={uploadingImage}
              className="w-full bg-[#ffffff] border border-[#dddddd] text-[#181d26] hover:bg-[#f8fafc] px-4 py-2 rounded-[6px] text-[12px] font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UploadCloud size={14} />
              {uploadingImage ? "Uploading..." : "Change Picture"}
            </button>
          </div>
        </div>

        {/* RIGHT CARD: FORM */}
        <div className="flex-1">
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#41454d]">First Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9297a0]" size={16} />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#ffffff] border border-[#dddddd] rounded-[6px] py-2.5 pl-9 pr-3 text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-[#9297a0] placeholder:font-normal"
                  placeholder="Enter your name"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#41454d]">Last Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9297a0]" size={16} />
                <input 
                  type="text" 
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="w-full bg-[#ffffff] border border-[#dddddd] rounded-[6px] py-2.5 pl-9 pr-3 text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-[#9297a0] placeholder:font-normal"
                  placeholder="Enter your surname"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#41454d]">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9297a0]" size={16} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#ffffff] border border-[#dddddd] rounded-[6px] py-2.5 pl-9 pr-3 text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-[#9297a0] placeholder:font-normal"
                  placeholder="email@snapschool.com"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[#41454d]">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9297a0]" size={16} />
                <input 
                  type="text" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#ffffff] border border-[#dddddd] rounded-[6px] py-2.5 pl-9 pr-3 text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-[#9297a0] placeholder:font-normal"
                  placeholder="+216 -- --- ---"
                />
              </div>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
};

export default ProfileClient;
