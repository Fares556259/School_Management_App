"use client";
import React from 'react';
import { Plus, Search, MessageSquare, History, Sparkles, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

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
    <div className="w-[280px] bg-[#171717] h-full flex flex-col p-4 text-slate-300">
      {/* New Chat Button */}
      <button
        onClick={onNewChat}
        className="flex items-center gap-3 w-full p-4 rounded-xl border border-white/10 hover:bg-white/5 transition-all mb-6 group"
      >
        <div className="bg-white/10 p-1.5 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
          <Plus size={18} className="text-white" />
        </div>
        <span className="text-sm font-bold text-white uppercase tracking-tight">Nouveau Chat</span>
      </button>

      {/* Search (Mock) */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Rechercher..."
          className="w-full bg-[#212121] border-none rounded-xl py-2.5 pl-10 pr-4 text-xs focus:ring-1 focus:ring-white/10 placeholder:text-slate-600 font-medium"
        />
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto space-y-6">
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 ml-2">Récents</h4>
          <div className="space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all text-left group ${
                  activeId === conv.id ? 'bg-white/10 text-white' : 'hover:bg-white/5'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${activeId === conv.id ? 'bg-indigo-500/20' : 'bg-transparent text-slate-500'} group-hover:bg-indigo-500/10`}>
                    <MessageSquare size={14} className={activeId === conv.id ? 'text-indigo-400' : ''} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold truncate">{conv.title}</p>
                  <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter mt-0.5">{conv.date}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 ml-2">Exploration</h4>
          <div className="space-y-1">
            <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/5 transition-all text-left">
              <Sparkles size={14} className="text-amber-400" />
              <span className="text-xs font-bold">Applications IA</span>
            </button>
            <button className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-white/5 transition-all text-left">
              <History size={14} className="text-blue-400" />
              <span className="text-xs font-bold">Historique complet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer / User */}
      <div className="mt-auto pt-4 border-t border-white/5">
        <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xs">
                    FA
                </div>
                <div>
                    <p className="text-xs font-black text-white">Fares Admin</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase">Plan Premium</p>
                </div>
            </div>
            <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-500 hover:text-rose-400">
                <LogOut size={16} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantSidebar;
