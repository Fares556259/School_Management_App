"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  LayoutDashboard, 
  Image as ImageIcon,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  DoorOpen,
  Hash,
  Save,
  HandCoins,
  Search,
  X,
  Columns
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  getSchoolConfig, 
  updateSchoolConfig,
  getLevelTuitionFees,
  updateLevelTuitionFee,
  getLevels,
  addSettingsClass,
  addLevel,
  deleteClass,
  syncLevelVariations
} from "../admin/actions/schoolActions";
import { 
  getRooms, 
  addRoom, 
  deleteRoom, 
  updateRoom 
} from "../admin/actions/infrastructureActions";

const SettingsPage = () => {
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);
  const [levelFees, setLevelFees] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [originalConfig, setOriginalConfig] = useState<any>(null);
  const [originalLevelFees, setOriginalLevelFees] = useState<any[]>([]);
  const [originalVariationCounts, setOriginalVariationCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // New Level Form State
  const [isAddingLevel, setIsAddingLevel] = useState(false);
  const [nextLevelNumber, setNextLevelNumber] = useState<number>(0);
  const [nextLevelFee, setNextLevelFee] = useState<number>(450);

  // Variation sync state
  const [variationCounts, setVariationCounts] = useState<Record<number, number>>({});

  // New Class Form State
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassLevel, setNewClassLevel] = useState<number>(0);
  const [newClassFee, setNewClassFee] = useState<number>(450);

  useEffect(() => {
    Promise.all([
      getSchoolConfig(),
      getRooms(),
      getLevelTuitionFees(),
      getLevels()
    ]).then(([configRes, roomsRes, feesRes, levelsRes]) => {
      if (configRes.success && configRes.data) {
        let sessions = configRes.data.sessions;
        if (typeof sessions === 'string') {
          try { sessions = JSON.parse(sessions); } catch (e) { sessions = []; }
        }
        const data = { 
          ...configRes.data, 
          sessions: sessions || []
        };
        setConfig(data);
        setOriginalConfig(JSON.parse(JSON.stringify(data)));
      }
      
      if (roomsRes.success && roomsRes.data) setRooms(roomsRes.data);
      if (feesRes.success && feesRes.data) {
        setLevelFees(feesRes.data);
        setOriginalLevelFees(JSON.parse(JSON.stringify(feesRes.data)));
        // Default next level number
        const maxLevel = feesRes.data.reduce((max: number, l: any) => Math.max(max, l.level), 0);
        setNextLevelNumber(maxLevel + 1);

        // Initialize variation counts
        const counts: Record<number, number> = {};
        feesRes.data.forEach((lvl: any) => {
          counts[lvl.id] = Array.isArray(lvl.classes) ? lvl.classes.length : 0;
        });
        setVariationCounts(counts);
        setOriginalVariationCounts(JSON.parse(JSON.stringify(counts)));
      }
      if (levelsRes.success && levelsRes.data) {
        setLevels(levelsRes.data);
        if (levelsRes.data.length > 0) setNewClassLevel(levelsRes.data[0].id);
      }
      
      setLoading(false);
    });
  }, []);

  const handleAddLevel = async () => {
    if (!nextLevelNumber) return;
    
    setSaving(true);
    const res = await addLevel(nextLevelNumber, nextLevelFee);
    
    if (res.success) {
      setLevelFees([...levelFees, res.data].sort((a,b) => a.level - b.level));
      setIsAddingLevel(false);
      setNextLevelNumber(nextLevelNumber + 1);
      setMessage({ type: 'success', text: `Level ${nextLevelNumber} added!` });
    } else {
      setMessage({ type: 'error', text: res.error || "Failed to add level" });
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUpdateLevelFee = (id: number, value: string) => {
    const fee = parseFloat(value);
    if (isNaN(fee)) return;
    
    // Update local state (Save button will detect change)
    setLevelFees(prev => prev.map(l => l.id === id ? { ...l, tuitionFee: fee } : l));
  };

  const handleDeleteClass = async (id: number) => {
    // Optimistic UI update
    setLevelFees(prev => prev.map(l => ({
      ...l,
      classes: l.classes?.filter((c: any) => c.id !== id)
    })));

    const res = await deleteClass(id);
    if (!res.success) {
      setMessage({ type: 'error', text: `Failed to delete class: ${res.error}` });
      // Re-fetch to sync if failed
      getLevelTuitionFees().then(res => {
         if (res.success && res.data) setLevelFees(res.data);
      });
    }
  };


  const handleAddRoom = async () => {
    const nextNum = rooms.length + 1;
    const res = await addRoom(`Salle ${nextNum}`);
    if (res.success) {
      setRooms([...rooms, res.data]);
    }
  };

  const handleRemoveRoom = async (id: number) => {
    const res = await deleteRoom(id);
    if (res.success) {
      setRooms(rooms.filter(r => r.id !== id));
    }
  };

  const handleSyncVariations = async (levelId: number) => {
    setSaving(true);
    const count = variationCounts[levelId] || 1;
    const res = await syncLevelVariations(levelId, count);
    
    if (res.success) {
      if (res.errors) {
        setMessage({ type: 'error', text: res.errors.join(" ") });
      } else {
        setMessage({ type: 'success', text: "Academic structure updated!" });
      }
      // Refresh fees to update chips
      getLevelTuitionFees().then(res => {
        if (res.success && res.data) setLevelFees(res.data);
      });
    } else {
      setMessage({ type: 'error', text: res.error || "Failed to sync Variations" });
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 5000);
  };

  const handleUpdateRoom = async (id: number, value: string) => {
    // Optimistic update
    setRooms(rooms.map(r => r.id === id ? { ...r, name: value } : r));
    await updateRoom(id, value);
  };

  const hasTuitionChanges = JSON.stringify(levelFees) !== JSON.stringify(originalLevelFees);
  const hasVariationChanges = JSON.stringify(variationCounts) !== JSON.stringify(originalVariationCounts);
  
  const hasChanges = (config && originalConfig && JSON.stringify(config) !== JSON.stringify(originalConfig)) || 
                     hasTuitionChanges || 
                     hasVariationChanges;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    
    try {
      // 1. Save standard school config
      const configRes = await updateSchoolConfig(config);
      if (!configRes.success) throw new Error(configRes.error || "Failed to update school config");

      // 2. Save Tuition Fee changes
      if (hasTuitionChanges) {
        for (const lvl of levelFees) {
          const originalLvl = originalLevelFees.find(o => o.id === lvl.id);
          if (originalLvl && originalLvl.tuitionFee !== lvl.tuitionFee) {
            const res = await updateLevelTuitionFee(lvl.id, lvl.tuitionFee);
            if (!res.success) throw new Error(`Failed to update fee for Level ${lvl.level}: ${res.error}`);
          }
        }
      }

      // 3. Save Variation changes (Sync)
      if (hasVariationChanges) {
        for (const [levelId, count] of Object.entries(variationCounts)) {
          const id = parseInt(levelId);
          if (originalVariationCounts[id] !== count) {
            const res = await syncLevelVariations(id, count);
            if (!res.success) throw new Error(`Failed to sync variations for level: ${res.error}`);
          }
        }
      }

      setMessage({ type: 'success', text: 'All settings updated successfully!' });
      
      // Hard refresh after a short delay so the user can see the success message
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("Save error:", error);
      setMessage({ type: 'error', text: error.message || 'Failed to update settings.' });
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
    const newSessions = config.sessions
      .filter((_: any, i: number) => i !== index)
      .map((s: any, i: number) => ({
        ...s,
        id: i + 1,
        label: `Session ${i + 1}`
      }));
    setConfig({ ...config, sessions: newSessions });
  };

  const addHoliday = () => {
    const today = new Date().toISOString().split('T')[0];
    const newHoliday = {
      id: Date.now(),
      name: "New Holiday",
      startDate: today,
      endDate: today
    };
    const currentHolidays = Array.isArray(config.holidays) ? config.holidays : [];
    setConfig({ ...config, holidays: [...currentHolidays, newHoliday] });
  };

  const removeHoliday = (id: number) => {
    const currentHolidays = Array.isArray(config.holidays) ? config.holidays : [];
    setConfig({ ...config, holidays: currentHolidays.filter((h: any) => h.id !== id) });
  };

  const updateHoliday = (id: number, field: string, value: string) => {
    const currentHolidays = Array.isArray(config.holidays) ? config.holidays : [];
    setConfig({
      ...config,
      holidays: currentHolidays.map((h: any) => h.id === id ? { ...h, [field]: value } : h)
    });
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

        <form onSubmit={handleUpdate} className="flex flex-col gap-10 pb-20">
          
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">School Phone Number</label>
                <input 
                   className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                   value={config.phone}
                   onChange={e => setConfig({...config, phone: e.target.value})}
                   placeholder="+216 71 000 000"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">School Address</label>
                <input 
                   className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                   value={config.address}
                   onChange={e => setConfig({...config, address: e.target.value})}
                   placeholder="123 Education Ave, Tunis"
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'School Logo', field: 'schoolLogo' },
                { label: 'Ministry Logo', field: 'ministryLogo' },
                { label: 'University Logo', field: 'universityLogo' }
              ].map((logo) => (
                <div key={logo.field} className="flex flex-col items-center gap-4 p-6 bg-slate-50 rounded-[28px] border border-slate-100/50 group hover:border-indigo-100 transition-all">
                    <div className="w-24 h-24 rounded-2xl bg-white shadow-sm border border-slate-50 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-300 relative">
                    {config[logo.field] ? (
                      <Image src={config[logo.field]} alt="Logo Preview" fill className="object-contain p-3" />
                    ) : (
                      <ImageIcon className="text-slate-200" size={32} />
                    )}
                  </div>
                  
                  <div className="flex flex-col items-center gap-3 w-full">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{logo.label}</label>
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
                      className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
                    >
                      {config[logo.field] ? 'Change Logo' : 'Upload Logo'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CLASSROOMS MANAGER */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <DoorOpen className="text-indigo-600" size={18} />
                <h2 className="text-xs font-black uppercase text-slate-400 tracking-[0.15em]">Physical Classrooms</h2>
              </div>
              <button 
                  type="button"
                  onClick={handleAddRoom}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                >
                  <Plus size={14} />
                  <span>Add Room</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence initial={false}>
                {rooms.length > 0 ? (
                  rooms.map((room: any) => (
                    <motion.div 
                      key={room.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl"
                    >
                      <div className="p-2 bg-white rounded-lg text-slate-400">
                        <Hash size={14} />
                      </div>
                      <input 
                        className="flex-1 bg-transparent border-none text-sm font-bold text-slate-700 focus:outline-none"
                        value={room.name}
                        onChange={e => handleUpdateRoom(room.id, e.target.value)}
                        placeholder="e.g. Salle 1"
                      />
                      <button 
                        type="button"
                        onClick={() => handleRemoveRoom(room.id)}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No rooms defined</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* TUITION FEES PER LEVEL */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
              <div className="flex items-center justify-between w-full md:w-auto gap-4">
                <div className="flex items-center gap-2">
                  <HandCoins className="text-emerald-600" size={18} />
                  <h2 className="text-xs font-black uppercase text-slate-400 tracking-[0.15em]">Tuition Fees per Academic Level</h2>
                </div>
              </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {levelFees.map((lvl: any) => (
                <div 
                  key={lvl.id}
                  className="flex flex-col gap-4 p-5 bg-slate-50 border border-slate-100 rounded-[24px] group hover:border-emerald-200 hover:bg-emerald-50/5 transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Primary</span>
                      <span className="text-sm font-black text-slate-700">Level {lvl.level}</span>
                    </div>
                    <div className="relative max-w-[100px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-400">$</span>
                      <input 
                        type="number"
                        className="w-full bg-white border border-slate-100 rounded-lg pl-6 pr-2 py-1.5 text-xs font-black text-slate-800 focus:outline-none focus:border-emerald-500 transition-all text-right"
                        value={lvl.tuitionFee}
                        onChange={(e) => handleUpdateLevelFee(lvl.id, e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {/* CLASS VARIATIONS (A, B, C...) */}
                  <div className="flex flex-wrap gap-2 mt-auto">
                     {lvl.classes?.map((cls: any) => (
                        <div key={cls.id} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-100 rounded-lg text-[10px] font-black text-slate-500 shadow-sm group/chip hover:border-emerald-200 transition-all">
                           <span>{cls.name}</span>
                           <button 
                             onClick={() => handleDeleteClass(cls.id)}
                             className="text-slate-300 hover:text-rose-500 transition-colors"
                           >
                             <X size={10} />
                           </button>
                        </div>
                     ))}
                  </div>
                </div>
              ))}
              
              {levelFees.length === 0 && !isAddingLevel && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[32px] gap-3 bg-slate-50/25">
                   <div className="p-3 bg-white rounded-2xl text-slate-200 shadow-sm">
                     <AlertCircle size={24} />
                   </div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pricing data not initialized</p>
                </div>
              )}
            </div>
          </div>

          {/* ACADEMIC STRUCTURE & VARIATIONS */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-6">
            <div className="flex items-center gap-2 mb-2">
              <Columns className="text-blue-600" size={18} />
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-[0.15em]">Academic Structure & Variations</h2>
            </div>

            <div className="flex flex-col gap-4">
              {levelFees.map((lvl: any) => (
                <div key={lvl.id} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-[24px] hover:border-blue-100 hover:bg-blue-50/10 transition-all shadow-sm">
                   <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Primary Grade</span>
                      <span className="text-sm font-black text-slate-700">Level {lvl.level}</span>
                   </div>
                   
                   <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1 items-end">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Variations (A-Z)</label>
                        <input 
                          type="number"
                          min={0}
                          max={26}
                          className="w-20 bg-white border border-slate-100 rounded-xl px-3 py-2 text-sm font-black text-slate-700 focus:outline-none focus:border-blue-500 transition-all text-center"
                          value={variationCounts[lvl.id] !== undefined ? variationCounts[lvl.id] : 0}
                          onChange={e => setVariationCounts({...variationCounts, [lvl.id]: parseInt(e.target.value) || 0})}
                        />
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
            <div className="flex flex-col gap-6">
               <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Academic Year</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
                    value={config.academicYear}
                    onChange={e => setConfig({...config, academicYear: e.target.value})}
                  />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div className="flex flex-col gap-1.5">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Year Starts</label>
                   <input 
                     type="date"
                     className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
                     value={config.yearStart ? new Date(config.yearStart).toISOString().split('T')[0] : ""}
                     onChange={e => setConfig({...config, yearStart: e.target.value})}
                   />
                 </div>
                 <div className="flex flex-col gap-1.5">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Year Ends</label>
                   <input 
                     type="date"
                     className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
                     value={config.yearEnd ? new Date(config.yearEnd).toISOString().split('T')[0] : ""}
                     onChange={e => setConfig({...config, yearEnd: e.target.value})}
                   />
                 </div>
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

          {/* HOLIDAYS MANAGER */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-6">
             <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-2">
                 <Calendar className="text-rose-500" size={18} />
                 <h2 className="text-xs font-black uppercase text-slate-400 tracking-[0.15em]">Holidays & Closures</h2>
               </div>
               <button 
                  type="button"
                  onClick={addHoliday}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-2"
                >
                  <Plus size={14} />
                  <span>Add Holiday</span>
               </button>
            </div>

            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence initial={false}>
                {Array.isArray(config.holidays) && config.holidays.length > 0 ? (
                  config.holidays.map((holiday: any) => (
                    <motion.div 
                      key={holiday.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group flex flex-col gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-rose-100 hover:bg-rose-50/10 transition-all relative overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex flex-col gap-1.5 flex-[2] w-full">
                           <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Event Name</label>
                           <input 
                              className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-300 transition-all"
                              value={holiday.name}
                              onChange={e => updateHoliday(holiday.id, 'name', e.target.value)}
                              placeholder="e.g. Independence Day"
                           />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 w-full">
                           <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                           <input 
                              type="date"
                              className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-300 transition-all"
                              value={holiday.startDate || holiday.date}
                              onChange={e => updateHoliday(holiday.id, 'startDate', e.target.value)}
                           />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 w-full">
                           <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                           <input 
                              type="date"
                              className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-300 transition-all"
                              value={holiday.endDate || holiday.date}
                              onChange={e => updateHoliday(holiday.id, 'endDate', e.target.value)}
                           />
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeHoliday(holiday.id)}
                          className="mt-4 p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                     <Calendar className="text-slate-200 mb-2" size={32} />
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No holidays scheduled yet</p>
                  </div>
                )}
              </AnimatePresence>
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
                        <div className="w-full bg-white/50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-black text-slate-400 cursor-not-allowed">
                          {`Session ${idx + 1}`}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-[2] w-full">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Time Window</label>
                        <select 
                          className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                          value={session.time}
                          onChange={e => {
                            const newSessions = [...config.sessions];
                            newSessions[idx] = { 
                              id: idx + 1, 
                              label: `Session ${idx + 1}`, 
                              time: e.target.value 
                            };
                            setConfig({ ...config, sessions: newSessions });
                          }}
                        >
                          <option value="08:00 - 10:00">08:00 - 10:00</option>
                          <option value="10:00 - 12:00">10:00 - 12:00</option>
                          <option value="12:00 - 14:00">12:00 - 14:00</option>
                          <option value="14:00 - 16:00">14:00 - 16:00</option>
                          <option value="16:00 - 18:00">16:00 - 18:00</option>
                        </select>
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

          {/* FLOATING SAVE BAR */}
          <AnimatePresence>
            {hasChanges && (
              <motion.div 
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-2xl"
              >
                 <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 p-3 pl-8 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] flex items-center justify-between group overflow-hidden">
                    <div className="flex flex-col gap-0.5">
                       <h3 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] leading-none">System Settings</h3>
                       <p className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Unsaved Changes
                       </p>
                    </div>

                    <div className="flex items-center gap-3">
                       <button 
                          type="button"
                          onClick={() => window.location.reload()}
                          className="px-6 py-3.5 text-white/40 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                       >
                          Discard
                       </button>
                       <button 
                          type="submit"
                          disabled={saving}
                          className="flex items-center gap-3 px-10 py-4 bg-white text-slate-900 font-black text-xs uppercase tracking-[0.15em] rounded-[2.5rem] hover:bg-emerald-400 hover:text-white transition-all shadow-xl disabled:opacity-50 group/save relative overflow-hidden"
                       >
                          <span className="relative z-10 flex items-center gap-2">
                             {saving ? <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div> : <Save size={18} />}
                             {saving ? 'Saving...' : 'Save Configuration'}
                          </span>
                       </button>
                    </div>

                    {/* Background glow effects */}
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-[80px]"></div>
                    <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px]"></div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>

        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
