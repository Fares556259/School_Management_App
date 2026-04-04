"use client";

import React from "react";
import { motion } from "framer-motion";

interface Notice {
  id: number;
  title: string;
  message: string;
  date: Date;
  important: boolean;
}

interface NoticeBoardProps {
  notices: Notice[];
}

const NoticeBoard: React.FC<NoticeBoardProps> = ({ notices }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase opacity-50">
          Admin Notice Board
        </h2>
        <span className="text-xs font-bold text-indigo-500 hover:underline cursor-pointer">
          See All
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {notices.length === 0 ? (
           <div className="py-8 text-center">
             <span className="text-slate-300 text-sm italic font-medium">No active announcements</span>
           </div>
        ) : (
          notices.map((notice, idx) => (
            <motion.div
              key={notice.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-4 rounded-2xl flex flex-col gap-2 border-l-4 ${
                notice.important 
                  ? "bg-rose-50 border-rose-400" 
                  : "bg-slate-50 border-indigo-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-bold tracking-tight ${
                  notice.important ? "text-rose-700" : "text-slate-800"
                }`}>
                  {notice.title}
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  {new Date(notice.date).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {notice.message}
              </p>
            </motion.div>
          ))
        )}
      </div>

      <div className="mt-2">
        <button className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold rounded-2xl hover:border-indigo-400 hover:text-indigo-400 transition-all flex items-center justify-center gap-2 group">
          <span className="text-lg group-hover:scale-125 transition-transform">+</span>
          Post New Announcement
        </button>
      </div>
    </motion.div>
  );
};

export default NoticeBoard;
