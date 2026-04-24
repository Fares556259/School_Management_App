"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { User, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface Student {
  id: string;
  name: string;
  surname: string;
  img?: string | null;
  class?: {
    name: string;
  };
}

interface StudentSelectorProps {
  students: Student[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const StudentSelector: React.FC<StudentSelectorProps> = ({ students, selectedId, onSelect }) => {
  return (
    <div className="flex flex-wrap gap-4 mb-8">
      {students.map((student) => {
        const isSelected = student.id === selectedId;
        return (
          <motion.button
            key={student.id}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(student.id)}
            className={`relative flex items-center gap-3 p-2 pr-6 rounded-full transition-all duration-300 border-2 ${
              isSelected 
                ? "bg-white border-primary shadow-lg shadow-primary/10" 
                : "bg-slate-50 border-transparent hover:bg-white hover:border-slate-200"
            }`}
          >
            <div className={`relative w-10 h-10 rounded-full overflow-hidden border-2 ${isSelected ? "border-primary" : "border-slate-200"}`}>
              {student.img ? (
                <Image src={student.img} alt={student.name} fill className="object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <User size={20} />
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-start">
              <span className={`text-sm font-black tracking-tight ${isSelected ? "text-slate-800" : "text-slate-500"}`}>
                {student.name} {student.surname}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {student.class?.name || "No Class"}
              </span>
            </div>

            {isSelected && (
              <motion.div 
                layoutId="active-indicator"
                className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow-md border-2 border-white"
              >
                <CheckCircle2 size={12} strokeWidth={3} />
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

export default StudentSelector;
