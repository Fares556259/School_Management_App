"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  name: string;
  options: Option[];
  defaultValue?: string[];
  placeholder?: string;
}

export default function MultiSelect({
  name,
  options,
  defaultValue = [],
  placeholder = "Select options...",
}: MultiSelectProps) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const removeOption = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected((prev) => prev.filter((v) => v !== value));
  };

  const selectedOptions = options.filter((o) => selected.includes(o.value));

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Hidden inputs to integrate with native form submission via FormData */}
      {selected.map((val) => (
        <input key={val} type="hidden" name={name} value={val} />
      ))}

      <div
        className={`min-h-[44px] w-full border ${
          isOpen ? "border-[#458fff] ring-1 ring-[#458fff]" : "border-[#dddddd]"
        } rounded-[6px] px-3 py-2 text-[14px] font-normal text-[#181d26] bg-white cursor-pointer transition-colors shadow-sm flex items-center justify-between gap-2`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex flex-wrap gap-1.5 flex-1">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 bg-[#f1f5f9] text-[#41454d] px-2 py-0.5 rounded-[4px] text-[12px] font-medium border border-[#e2e8f0]"
              >
                {opt.label}
                <button
                  type="button"
                  onClick={(e) => removeOption(opt.value, e)}
                  className="hover:text-rose-500 transition-colors focus:outline-none"
                >
                  <X size={12} />
                </button>
              </span>
            ))
          ) : (
            <span className="text-[#a1a1aa]">{placeholder}</span>
          )}
        </div>
        <div className="text-[#a1a1aa] flex-shrink-0">
          <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#dddddd] rounded-[8px] shadow-lg max-h-[220px] overflow-y-auto z-[100] custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
          {options.length > 0 ? (
            <div className="p-1 space-y-0.5">
              {options.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    className="flex items-center justify-between px-3 py-2 cursor-pointer rounded-[6px] hover:bg-[#f8fafc] transition-colors"
                  >
                    <span className={`text-[13px] ${isSelected ? "font-medium text-[#458fff]" : "text-[#41454d]"}`}>
                      {opt.label}
                    </span>
                    {isSelected && <Check size={14} className="text-[#458fff]" />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-[13px] text-[#9297a0]">
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
