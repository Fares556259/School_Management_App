"use client";

import { useState, useEffect } from "react";
import { 
  School, 
  Building2, 
  GraduationCap, 
  LayoutDashboard, 
  Save, 
  Image as ImageIcon,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getSchoolConfig, updateSchoolConfig } from "../admin/actions/schoolActions";

const SettingsPage = () => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    getSchoolConfig().then(res => {
      if (res.success) {
        // Ensure sessions is parsed if it's a string, or just use as is if it's already an object
        let sessions = res.data.sessions;
        if (typeof sessions === 'string') {
          try { sessions = JSON.parse(sessions); } catch (e) { sessions = []; }
        }
        setConfig({ ...res.data, sessions: sessions || [] });
      }
      setLoading(false);
    });
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    
    const res = await updateSchoolConfig(config);
    if (res.success) {
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
    } else {
      setMessage({ type: 'error', text: 'Failed to update settings.' });
    }
    setSaving(false);
    
    setTimeout(() => setMessage(null), 3000);
  };

  const updateSession = (index: number, field: 'label' | 'time', value: string) => {
    const newSessions = [...config.sessions];
    newSessions[index] = { ...newSessions[index], [field]: value };
    setConfig({ ...config, sessions: newSessions });
  };
  
  const addSession = () => {
    const newSession = {
      id: Date.now(),
      label: `Session ${config.sessions.length + 1}`,
      time: "08:00 - 10:00"
    };
    setConfig({ ...config, sessions: [...config.sessions, newSession] });
  };

  const removeSession = (index: number) => {
    const newSessions = config.sessions.filter((_: any, i: number) => i !== index);
    setConfig({ ...config, sessions: newSessions });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'schoolLogo' | 'ministryLogo' | 'universityLogo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSaving(true);
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      
      const fileName = `brand-${field}-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const filePath = `branding/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      setConfig({ ...config, [field]: publicUrl });
      setMessage({ type: 'success', text: 'Logo uploaded. Remember to save changes!' });
    } catch (err: any) {
      console.error(`${field} upload failed:`, err);
      setMessage({ type: 'error', text: `Failed to upload logo: ${err.message}` });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#F7F8FA]">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex-1 p-8 bg-[#F7F8FA] overflow-y-auto">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        
        {/* HEADER */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                <LayoutDashboard size={24} />
             </div>
             <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Settings</h1>
                <p className="text-slate-400 text-sm font-medium">Configure institutional branding and academic parameters.</p>
             </div>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 border ${
            message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
            : 'bg-rose-50 text-rose-600 border-rose-100'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold text-sm tracking-tight">{message.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
          
          {/* INSTITUTIONAL NAMES */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-6">
            <div className="flex items-center gap-2 mb-2">
               <Building2 className="text-indigo-600" size={18} />
               <h2 className="text-xs font-black uppercase text-slate-400 tracking-[0.15em]">Institutional Identity</h2>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">School Name</label>
                <input 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                  value={config.schoolName}
                  onChange={e => setConfig({...config, schoolName: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Ministry Name</label>
                <input 
                   className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                   value={config.ministryName}
                   onChange={e => setConfig({...config, ministryName: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">University Name</label>
                <input 
                   className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                   value={config.universityName}
                   onChange={e => setConfig({...config, universityName: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* BRANDING LOGOS */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-6">
            <div className="flex items-center gap-2 mb-2">
               <ImageIcon className="text-indigo-600" size={18} />
               <h2 className="text-xs font-black uppercase text-slate-400 tracking-[0.15em]">Branding Assets</h2>
            </div>
            
            <div className="flex flex-col gap-6">
              {[
                { label: 'School Logo', field: 'schoolLogo' },
                { label: 'Ministry Logo', field: 'ministryLogo' },
                { label: 'University Logo', field: 'universityLogo' }
              ].map((logo) => (
                <div key={logo.field} className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{logo.label}</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                      {config[logo.field] ? (
                        <img src={config[logo.field]} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                      ) : (
                        <ImageIcon className="text-slate-300" size={24} />
                      )}
                    </div>
                    <div className="flex-1">
                      <input 
                        type="file" 
                        id={`upload-${logo.field}`}
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, logo.field as any)}
                      />
                      <button 
                        type="button"
                        onClick={() => document.getElementById(`upload-${logo.field}`)?.click()}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all text-center"
                      >
                        {config[logo.field] ? 'Change Logo' : 'Upload Logo'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ACADEMIC PERIOD */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-6">
             <div className="flex items-center gap-2 mb-2">
               <Calendar className="text-indigo-600" size={18} />
               <h2 className="text-xs font-black uppercase text-slate-400 tracking-[0.15em]">Academic Period</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="flex flex-col gap-1.5">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Academic Year</label>
                 <input 
                   className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
                   value={config.academicYear}
                   onChange={e => setConfig({...config, academicYear: e.target.value})}
                 />
               </div>
               <div className="flex flex-col gap-1.5">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Current Semester</label>
                 <select 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 transition-all appearance-none"
                    value={config.currentSemester}
                    onChange={e => setConfig({...config, currentSemester: parseInt(e.target.value)})}
                 >
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                 </select>
               </div>
            </div>
          </div>

          {/* SESSIONS CONFIG */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-6">
             <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-2">
                <Clock className="text-indigo-600" size={18} />
                <h2 className="text-xs font-black uppercase text-slate-400 tracking-[0.15em]">Daily Sessions</h2>
               </div>
               <button 
                type="button"
                onClick={addSession}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
               >
                 <Plus size={14} /> Add Session
               </button>
            </div>
            <div className="flex flex-col gap-4">
               <AnimatePresence mode="popLayout">
                {config.sessions.map((session: any, idx: number) => (
                  <motion.div 
                    key={session.id || idx}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: -20 }}
                    layout
                    className="flex flex-col sm:flex-row items-end gap-3 p-5 bg-slate-50 rounded-2xl border border-slate-100 group relative"
                  >
                      <div className="flex flex-col gap-1.5 flex-1 w-full">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Session Label</label>
                        <input 
                          className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          value={session.label}
                          placeholder="e.g. Session 1"
                          onChange={e => updateSession(idx, 'label', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 flex-[1.5] w-full">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Time Window</label>
                        <input 
                          className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          value={session.time}
                          placeholder="08:00 - 10:00"
                          onChange={e => updateSession(idx, 'time', e.target.value)}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeSession(idx)}
                        className="p-2.5 bg-white border border-slate-100 rounded-xl text-rose-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all shadow-sm mb-0.5"
                        title="Remove Session"
                      >
                        <Trash2 size={16} />
                      </button>
                  </motion.div>
                ))}
               </AnimatePresence>
               
               {config.sessions.length === 0 && (
                 <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl gap-4 bg-slate-50/50">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200">
                      <Clock size={24} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No sessions defined</p>
                    <button 
                      type="button"
                      onClick={addSession}
                      className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50 transition-all"
                    >
                      Initialize first session
                    </button>
                 </div>
               )}
            </div>
          </div>

          {/* SAVE BUTTON */}
          <div className="md:col-span-2 flex justify-end gap-4 mt-4">
             <button 
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-10 py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 hover:shadow-slate-200 disabled:opacity-50 group overflow-hidden relative"
             >
                <span className="relative z-10 flex items-center gap-2">
                   {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={18} />}
                   {saving ? 'Synchronizing...' : 'Save Configuration'}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-indigo-700 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
             </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
