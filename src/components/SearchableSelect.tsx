"use client";

import React, { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  name: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  onSelect?: (value: string) => void;
  className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options = [],
  name,
  placeholder = "Search and select...",
  defaultValue = "",
  required = false,
  onSelect,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal selectedValue with defaultValue prop
  useEffect(() => {
    setSelectedValue(defaultValue);
    const option = options.find((o) => o.value === defaultValue);
    if (option) {
      setSearchTerm(option.label);
    }
  }, [defaultValue, options]);

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search term to selected label if user clicks away without selecting
        const currentOption = options.find(o => o.value === selectedValue);
        if (currentOption) {
          setSearchTerm(currentOption.label);
        } else if (!selectedValue) {
          setSearchTerm("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedValue, options]);

  const handleSelect = (option: Option) => {
    setSelectedValue(option.value);
    setSearchTerm(option.label);
    setIsOpen(false);
    if (onSelect) onSelect(option.value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setIsOpen(true);
    
    // Auto-clear selectedValue if input is cleared
    if (val === "") {
      setSelectedValue("");
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef} style={{ zIndex: isOpen ? 1000 : 1 }}>
      {/* Search Input Field */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all pr-10 shadow-sm"
          required={required && !selectedValue}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {searchTerm && isOpen ? (
             <button 
               type="button" 
               className="pointer-events-auto hover:text-rose-500"
               onClick={(e) => {
                 e.stopPropagation();
                 setSearchTerm("");
                 setSelectedValue("");
                 setIsOpen(true);
               }}
             >
               ✕
             </button>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* Hidden field for form data */}
      <input type="hidden" name={name} value={selectedValue} />

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200" style={{ zIndex: 1000 }}>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 transition-colors flex items-center justify-between border-b border-slate-50 last:border-0 ${
                    selectedValue === option.value ? "bg-indigo-50/50 text-indigo-700 font-medium" : "text-slate-700"
                  }`}
                  onClick={() => handleSelect(option)}
                >
                  <span className="truncate">{option.label}</span>
                  {selectedValue === option.value && (
                    <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))
            ) : (
              <div className="px-3 py-5 text-sm text-slate-400 text-center bg-slate-50/50 italic">
                {searchTerm ? `No matches for "${searchTerm}"` : "Start typing to search..."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
