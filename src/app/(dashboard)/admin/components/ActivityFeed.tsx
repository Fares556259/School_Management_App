"use client";

import React from 'react';
import moment from 'moment';

interface AuditLog {
  id: number;
  action: string;
  performedBy: string;
  entityType: string;
  description: string;
  timestamp: Date;
}

interface ActivityFeedProps {
  logs: AuditLog[];
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ logs }) => {
  const getActionColor = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('create')) return 'bg-emerald-500';
    if (a.includes('update')) return 'bg-amber-500';
    if (a.includes('delete')) return 'bg-rose-500';
    return 'bg-indigo-500';
  };

  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase opacity-50">Recent Activity</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Live Audit Feed</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-xs">
          🕒
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {logs.map((log, index) => (
          <div key={log.id} className="relative flex gap-4">
            {/* Timeline Line */}
            {index !== logs.length - 1 && (
              <div className="absolute left-[7px] top-4 w-[2px] h-full bg-slate-100" />
            )}
            
            <div className={`mt-1 w-4 h-4 rounded-full border-4 border-white shadow-sm shrink-0 z-10 ${getActionColor(log.action)}`} />
            
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-black text-slate-800 tracking-tight italic">
                  {log.performedBy}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {moment(log.timestamp).fromNow()}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                <span className="font-bold text-slate-700 uppercase tracking-tighter text-[9px] mr-1">
                  [{log.entityType}]
                </span>
                {log.description}
              </p>
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No recent activity detected</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
