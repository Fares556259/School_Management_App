"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, X, Search } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  name: string;
  options: Option[];
  defaultValue?: string[];
  placeholder?: string;
  onChange?: (selected: string[]) => void;
  className?: string;
}

export default function MultiSelect({
  name,
  options,
  defaultValue = [],
  placeholder,
  onChange,
  className = "",
}: MultiSelectProps) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { locale } = useLanguage();

  // Sync internal selected state when defaultValue changes (e.g. opening different records)
  useEffect(() => {
    setSelected(defaultValue);
  }, [JSON.stringify(defaultValue)]);

  // Localized UI text
  const labels = useMemo(() => {
    if (locale === "ar") {
      return {
        searchPlaceholder: "بحث...",
        selectAll: "تحديد الكل",
        deselectAll: "إلغاء التحديد",
        selectedCount: (n: number) => `${n} محدد`,
        noResults: "لا توجد نتائج",
        noOptions: "لا توجد خيارات متاحة",
        defaultPlaceholder: "اختر خيارات...",
      };
    }
    if (locale === "fr") {
      return {
        searchPlaceholder: "Rechercher...",
        selectAll: "Tout cocher",
        deselectAll: "Tout décocher",
        selectedCount: (n: number) => `${n} sélectionné${n > 1 ? "s" : ""}`,
        noResults: "Aucun résultat trouvé",
        noOptions: "Aucune option disponible",
        defaultPlaceholder: "Sélectionner...",
      };
    }
    return {
      searchPlaceholder: "Search...",
      selectAll: "Select all",
      deselectAll: "Deselect all",
      selectedCount: (n: number) => `${n} selected`,
      noResults: "No results found",
      noOptions: "No options available",
      defaultPlaceholder: "Select options...",
    };
  }, [locale]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Check placement on scroll or resize when open
  useEffect(() => {
    if (!isOpen) return;

    const checkPlacement = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollParent = containerRef.current.closest(".overflow-y-auto") || document.body;
      const parentRect = scrollParent.getBoundingClientRect();

      const spaceBelowInParent = parentRect.bottom - rect.bottom;
      const spaceBelowInWindow = window.innerHeight - rect.bottom;
      const spaceAboveInParent = rect.top - parentRect.top;

      const shouldOpenUpwards =
        (spaceBelowInParent < 240 || spaceBelowInWindow < 240) && spaceAboveInParent > 150;
      setOpenUpwards(shouldOpenUpwards);
    };

    const scrollParent = containerRef.current?.closest(".overflow-y-auto");
    scrollParent?.addEventListener("scroll", checkPlacement);
    window.addEventListener("resize", checkPlacement);
    return () => {
      scrollParent?.removeEventListener("scroll", checkPlacement);
      window.removeEventListener("resize", checkPlacement);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens WITHOUT scrolling the modal
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 50);
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scrollParent = containerRef.current.closest(".overflow-y-auto") || document.body;
      const parentRect = scrollParent.getBoundingClientRect();

      const spaceBelowInParent = parentRect.bottom - rect.bottom;
      const spaceBelowInWindow = window.innerHeight - rect.bottom;
      const spaceAboveInParent = rect.top - parentRect.top;

      const shouldOpenUpwards =
        (spaceBelowInParent < 240 || spaceBelowInWindow < 240) && spaceAboveInParent > 150;
      setOpenUpwards(shouldOpenUpwards);
    }
    setIsOpen((prev) => !prev);
  };

  const toggleOption = (value: string) => {
    setSelected((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      onChange?.(next);
      return next;
    });
  };

  const removeOption = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected((prev) => {
      const next = prev.filter((v) => v !== value);
      onChange?.(next);
      return next;
    });
  };

  // Filtered options based on search term
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.trim().toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, search]);

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const visibleValues = filteredOptions.map((o) => o.value);
    setSelected((prev) => {
      const next = Array.from(new Set([...prev, ...visibleValues]));
      onChange?.(next);
      return next;
    });
  };

  const handleDeselectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const visibleSet = new Set(filteredOptions.map((o) => o.value));
    setSelected((prev) => {
      const next = prev.filter((v) => !visibleSet.has(v));
      onChange?.(next);
      return next;
    });
  };

  const selectedOptions = useMemo(() => {
    return options.filter((o) => selected.includes(o.value));
  }, [options, selected]);

  const resolvedPlaceholder = placeholder || labels.defaultPlaceholder;

  return (
    <div
      className={`relative w-full ${className}`}
      ref={containerRef}
      style={{ zIndex: isOpen ? 100 : 1 }}
    >
      {/* Hidden inputs to integrate with native form submission via FormData */}
      {selected.map((val) => (
        <input key={val} type="hidden" name={name} value={val} />
      ))}

      {/* Trigger input field */}
      <div
        className={`min-h-[44px] w-full border ${
          isOpen
            ? "border-[#458fff] ring-2 ring-[#458fff]/20 shadow-sm"
            : "border-[#dddddd] hover:border-slate-300"
        } rounded-[6px] px-3 py-1.5 text-[14px] bg-white cursor-pointer transition-all flex items-center justify-between gap-2`}
        onClick={handleToggle}
      >
        <div className="flex flex-wrap gap-1.5 flex-1 items-center py-0.5">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-2.5 py-1 rounded-[5px] text-[12px] font-semibold border border-slate-200/90 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                <span dir="auto">{opt.label}</span>
                <button
                  type="button"
                  onClick={(e) => removeOption(opt.value, e)}
                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded p-0.5 transition-colors focus:outline-none"
                  title="Supprimer"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </span>
            ))
          ) : (
            <span className="text-slate-400 text-[13px]">{resolvedPlaceholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 shrink-0 ml-1">
          {selected.length > 0 && (
            <span className="text-[11px] font-bold text-[#458fff] bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
              {selected.length}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${
              isOpen ? "rotate-180 text-[#458fff]" : "text-slate-400"
            }`}
          />
        </div>
      </div>

      {/* Dropdown Menu with Checkboxes (Smart Top or Bottom placement) */}
      {isOpen && (
        <div
          className={`absolute left-0 w-full bg-white border border-slate-200 rounded-[8px] shadow-2xl flex flex-col z-[200] overflow-hidden ${
            openUpwards
              ? "bottom-full mb-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150"
              : "top-full mt-1.5 animate-in fade-in slide-in-from-top-2 duration-150"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar: Search & Quick Batch Actions */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/90 flex flex-col gap-1.5">
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={labels.searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-[12px] bg-white border border-slate-200 rounded-[6px] focus:outline-none focus:border-[#458fff] focus:ring-1 focus:ring-[#458fff] transition-all text-slate-800 placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Quick Actions Header - guaranteed single line with whitespace-nowrap */}
            {options.length > 0 && (
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 whitespace-nowrap gap-2">
                <span className="font-semibold text-slate-600 whitespace-nowrap">
                  {labels.selectedCount(selected.length)}
                </span>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[#458fff] hover:text-[#2563eb] font-semibold hover:underline whitespace-nowrap"
                  >
                    {labels.selectAll}
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="text-slate-500 hover:text-slate-800 font-medium hover:underline whitespace-nowrap"
                  >
                    {labels.deselectAll}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Options List with Checkboxes (Compact scroll area) */}
          <div className="p-1 space-y-0.5 overflow-y-auto max-h-[170px] custom-scrollbar flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    className={`group flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer rounded-[6px] transition-all select-none ${
                      isSelected
                        ? "bg-blue-50/80 hover:bg-blue-100/70 text-slate-900"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {/* Modern Checkbox Box */}
                    <div
                      className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all shrink-0 ${
                        isSelected
                          ? "bg-[#458fff] border-[#458fff] text-white shadow-xs"
                          : "border-slate-300 bg-white group-hover:border-[#458fff]/70"
                      }`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3.5} className="text-white" />}
                    </div>

                    {/* Label */}
                    <span
                      className={`text-[13px] flex-1 truncate ${
                        isSelected
                          ? "font-semibold text-slate-900"
                          : "font-normal text-slate-700 group-hover:text-slate-900"
                      }`}
                      dir="auto"
                    >
                      {opt.label}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-[12px] text-slate-400">
                {search ? labels.noResults : labels.noOptions}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
