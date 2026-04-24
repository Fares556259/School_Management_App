"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Layout, 
  CheckCircle2, 
  FileText, 
  BookOpen, 
  MessageSquare,
  ChevronRight,
  Clock
} from "lucide-react";

interface GlanceItemProps {
  icon: any;
  title: string;
  subtitle: string;
  color: string;
  count?: number;
  onPress?: () => void;
}

const GlanceItem: React.FC<GlanceItemProps> = ({ icon: Icon, title, subtitle, color, count, onPress }) => (
  <motion.button
    whileHover={{ x: 4 }}
    onClick={onPress}
    className="w-full group flex items-center gap-4 p-4 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all mb-3"
  >
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110`} style={{ backgroundColor: `${color}15` }}>
      <Icon size={20} color={color} />
    </div>
    
    <div className="flex-1 text-left">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-black text-slate-800 tracking-tight">{title}</h4>
        {count !== undefined && count > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{ backgroundColor: color }}>
            {count}
          </span>
        )}
      </div>
      <p className="text-[11px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider line-clamp-1">{subtitle}</p>
    </div>

    <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors" />
  </motion.button>
);

interface GlanceHubProps {
  data: {
    sessionsCount: number;
    tasksCount: number;
    newTasksCount: number;
    resourcesCount: number;
    remarksCount: number;
  };
}

const GlanceHub: React.FC<GlanceHubProps> = ({ data }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Today at a Glance</h2>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      <GlanceItem 
        icon={Layout} 
        title="Today's Sessions" 
        subtitle={data.sessionsCount > 0 ? `${data.sessionsCount} sessions scheduled` : "No sessions today"} 
        color="#0055d4"
        count={data.sessionsCount}
      />
      <GlanceItem 
        icon={CheckCircle2} 
        title="Tasks to Submit" 
        subtitle={data.tasksCount > 0 ? "Items due today" : "Nothing due today"} 
        color="#10b981" 
        count={data.tasksCount}
      />
      <GlanceItem 
        icon={FileText} 
        title="New Tasks Given" 
        subtitle={data.newTasksCount > 0 ? "New assignments shared" : "No new tasks"} 
        color="#f59e0b" 
        count={data.newTasksCount}
      />
      <GlanceItem 
        icon={BookOpen} 
        title="Course Resources" 
        subtitle={data.resourcesCount > 0 ? "Latest shared files" : "No new resources"} 
        color="#8b5cf6" 
        count={data.resourcesCount}
      />
      <GlanceItem 
        icon={MessageSquare} 
        title="Teacher Remarks" 
        subtitle={data.remarksCount > 0 ? "New updates from staff" : "No new remarks"} 
        color="#ec4899" 
        count={data.remarksCount}
      />
    </div>
  );
};

export default GlanceHub;
