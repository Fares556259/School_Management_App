"use client";
import SnapAssistant from "../../admin/components/SnapAssistant";
import AssistantSidebar from "../../admin/components/AssistantSidebar";
import { useState } from "react";
import { X, Info, Calendar, ShieldCheck, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const AssistantClient = ({
  dashboardContext,
  activities,
  chatHistory,
  month,
  year,
  usageStats = { usage: 0, quota: 10 }
}: {
  dashboardContext: any;
  activities: any[];
  chatHistory: any[];
  month: number;
  year: number;
  usageStats: { usage: number; quota: number };
}) => {
  const [activeSession, setActiveSession] = useState("new");
  const [chatKey, setChatKey] = useState(0);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [currentUsage, setCurrentUsage] = useState(usageStats || { usage: 0, quota: 10 });

  const handleNewChat = () => {
    setChatKey(prev => prev + 1);
    setActiveSession("new");
    setSelectedActivity(null);
    setInitialMessages([]);
  };

  const handleSelectActivity = (item: any) => {
    setActiveSession(item.id);
    if (item.type === "LOG") {
      setSelectedActivity(item);
    } else if (item.type === "CHAT") {
      setInitialMessages(item.messages || []);
      setChatKey(prev => prev + 1);
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] -m-6 flex overflow-hidden bg-slate-50/30 relative">
      <AnimatePresence>
        {selectedActivity && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-slate-900/10 backdrop-blur-md flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden flex flex-col"
            >
              <div className="p-10 flex-1">
                <div className="flex items-center justify-between mb-8">
                  <div className="bg-indigo-50 p-4 rounded-3xl">
                    <ShieldCheck size={32} className="text-indigo-600" />
                  </div>
                  <button 
                    onClick={() => setSelectedActivity(null)}
                    className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">Intelligence Log</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-auto flex items-center gap-1">
                      <Calendar size={10} />
                      {selectedActivity.date}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 leading-tight">
                    Fiche d'Intelligence
                  </h2>
                </div>

                <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 mb-8">
                  <p className="text-lg font-bold text-slate-700 leading-relaxed italic">
                    "{selectedActivity.fullDesc}"
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Info size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Statut de l'Action</p>
                      <p className="text-sm text-slate-500 font-medium">Exécuté avec succès par l'Assistant IA Zbiba.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => setSelectedActivity(null)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-3xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 group"
                >
                  <span>Continuer</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. ChatGPT-Style Sidebar */}
      <AssistantSidebar 
        conversations={[...chatHistory, ...activities]}
        activeId={activeSession}
        onSelect={handleSelectActivity}
        onNewChat={handleNewChat}
        usage={currentUsage.usage}
        quota={currentUsage.quota}
      />

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 p-8 overflow-hidden">
          <SnapAssistant 
            key={chatKey}
            context={dashboardContext} 
            fullPage={true} 
            onNewChat={handleNewChat}
            onUsageUpdate={() => {
              setCurrentUsage(prev => ({ ...prev, usage: prev.usage + 1 }));
            }}
            initialMessages={initialMessages}
            activeSessionId={activeSession}
            month={month}
            year={year}
          />
        </div>
      </div>
    </div>
  );
};

export default AssistantClient;
