"use client";
import React from 'react';
import { Plus, Search, MessageSquare, History, Sparkles, LogOut } from 'lucide-react';

interface AssistantSidebarProps {
  conversations: { id: string; title: string; date: string }[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

const AssistantSidebar: React.FC<AssistantSidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat
}) => {
  return (
    <div className="w-[300px] bg-slate-50/50 border-r border-slate-100 h-full flex flex-col p-6 text-slate-600">
      {/* New Chat Button - SnapSchool Style */}
      <button
        onClick={onNewChat}
        className="flex items-center justify-center gap-3 w-full p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100 transition-all mb-8 group active:scale-95"
      >
        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
        <span className="text-sm font-black uppercase tracking-tight">Nouveau Chat</span>
      </button>

      {/* Search - Integrated Style */}
      <div className="relative mb-8">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher Intelligence..."
          className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-xs focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 transition-all placeholder:text-slate-400 font-bold"
        />
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto space-y-8 scrollbar-hide">
        <div>
          <div className="flex items-center justify-between mb-4 px-2">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Récents</h4>
          </div>
          <div className="space-y-1.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`flex items-center gap-3 w-full p-3.5 rounded-2xl transition-all text-left group ${
                  activeId === conv.id 
                    ? 'bg-white shadow-sm border border-slate-100 text-indigo-600 ring-2 ring-indigo-500/5' 
                    : 'hover:bg-white/60 text-slate-500 hover:text-slate-900'
                }`}
              >
                <div className={`p-2 rounded-xl ${activeId === conv.id ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100/50 text-slate-400'} group-hover:scale-110 transition-transform`}>
                    <MessageSquare size={14} />
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-xs font-black truncate leading-none">{conv.title}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{conv.date}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-2">Intelligence</h4>
          <div className="space-y-1.5">
            <button className="flex items-center gap-3 w-full p-3.5 rounded-2xl hover:bg-white/60 transition-all text-left group">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-500 group-hover:scale-110 transition-transform">
                <Sparkles size={14} />
              </div>
              <span className="text-xs font-black">AI Models Beta</span>
            </button>
            <button className="flex items-center gap-3 w-full p-3.5 rounded-2xl hover:bg-white/60 transition-all text-left group">
              <div className="p-2 rounded-xl bg-sky-50 text-sky-500 group-hover:scale-110 transition-transform">
                <History size={14} />
              </div>
              <span className="text-xs font-black">Memory Log</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer / User - SnapSchool Style */}
      <div className="mt-auto pt-6 border-t border-slate-100">
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-indigo-100">
                    FA
                </div>
                <div>
                    <p className="text-xs font-black text-slate-900">Admin Fares</p>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Plan Enterprise</p>
                    </div>
                </div>
            </div>
            <button className="p-2 hover:bg-rose-50 rounded-xl transition-colors text-slate-400 hover:text-rose-500 group">
                <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantSidebar;
