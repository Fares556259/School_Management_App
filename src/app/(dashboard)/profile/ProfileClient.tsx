"use client";

import { useState } from "react";
import Image from "next/image";
import { updateAdminProfile } from "../admin/actions/profileActions";
import { User, Mail, Phone, Camera, Check, AlertCircle } from "lucide-react";

interface ProfileClientProps {
  initialData: any;
}

const ProfileClient = ({ initialData }: ProfileClientProps) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  const [name, setName] = useState(initialData?.name || "");
  const [surname, setSurname] = useState(initialData?.surname || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [img, setImg] = useState(initialData?.img || "/noAvatar.png");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await updateAdminProfile({
        name,
        surname,
        email,
        phone,
        img: img !== "/noAvatar.png" ? img : null,
      });

      if (res.success) {
        setSuccess(true);
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

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* LEFT CARD: IDENTITY */}
        <div className="flex-1 max-w-sm">
          <div className="bg-white/80 backdrop-blur-xl border border-white/20 p-8 rounded-[40px] shadow-2xl shadow-indigo-100/50 flex flex-col items-center text-center relative overflow-hidden group">
            {/* Background Decor */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:bg-indigo-100 transition-colors duration-700"></div>
            
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-[32px] overflow-hidden border-4 border-white shadow-xl group-hover:scale-105 transition-transform duration-500">
                <Image 
                  src={img} 
                  alt="Avatar" 
                  fill 
                  className="object-cover"
                />
              </div>
              
              <input
                type="file"
                id="avatar-upload"
                className="hidden"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
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
                  } catch (err: any) {
                    console.error("Profile upload failed:", err);
                    setError(err.message || "Failed to upload profile image.");
                  }
                }}
              />
              <button 
                onClick={() => document.getElementById('avatar-upload')?.click()}
                className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center border-4 border-white shadow-lg hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95"
              >
                <Camera size={18} />
              </button>
            </div>

            <h2 className="text-2xl font-black text-slate-800 tracking-tighter">
              {name || surname ? `${name} ${surname}` : initialData?.username}
            </h2>
            <p className="text-sm font-bold text-indigo-500 mt-1 uppercase tracking-widest">Administrator</p>
            
            <div className="w-full h-px bg-slate-100 my-6"></div>
            
            <div className="w-full flex flex-col gap-4">
              <div className="flex items-center gap-3 text-slate-500">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                  <Mail size={16} className="text-slate-400" />
                </div>
                <span className="text-sm font-medium">{email || "No email set"}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                  <Phone size={16} className="text-slate-400" />
                </div>
                <span className="text-sm font-medium">{phone || "No phone set"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CARD: FORM */}
        <div className="flex-[2]">
          <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 h-full">
            <div className="flex items-center justify-between mb-8">
               <h1 className="text-3xl font-black text-slate-800 tracking-tighter">Edit Profile</h1>
               {success && (
                 <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 animate-in fade-in slide-in-from-top-4 duration-500">
                   <Check size={16} className="stroke-[3px]" />
                   <span className="text-xs font-black uppercase tracking-wider">Changes Saved</span>
                 </div>
               )}
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all placeholder:text-slate-300"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all placeholder:text-slate-300"
                    placeholder="Enter your surname"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all placeholder:text-slate-300"
                    placeholder="email@snapschool.com"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all placeholder:text-slate-300"
                    placeholder="+216 -- --- ---"
                  />
                </div>
              </div>

              <div className="md:col-span-2 mt-4">
                {error && (
                  <div className="mb-4 flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-3 rounded-2xl border border-rose-100">
                    <AlertCircle size={18} />
                    <span className="text-sm font-bold">{error}</span>
                  </div>
                )}
                
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full md:w-auto min-w-[200px] bg-indigo-600 text-white font-black uppercase tracking-widest text-xs py-5 px-10 rounded-2xl hover:bg-slate-900 transition-all hover:shadow-2xl hover:shadow-indigo-200 active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-indigo-600 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-4 border-white border-t-transparent animate-spin rounded-full"></div>
                  ) : (
                    <>
                      <span>Save Changes</span>
                      <Check size={18} className="stroke-[3px]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileClient;
