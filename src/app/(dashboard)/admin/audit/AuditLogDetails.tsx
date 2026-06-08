"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Calendar, Banknote, Clock, Copy, Check,
  ExternalLink, Bot, Sparkles, ArrowRight, ChevronDown, ChevronUp
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/lib/translations/LanguageContext";

// ── Readable field label map ─────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  amount: "Amount", status: "Status", paidAt: "Paid At", deferredAmount: "Deferred",
  deferredUntil: "Until", month: "Month", year: "Year", img: "Proof",
  title: "Title", category: "Category", date: "Date", description: "Note",
  type: "Type", userType: "User Type",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuditLog {
  id: number;
  action: string;
  performedBy: string;
  performer?: { name: string; email?: string; avatar?: string; role?: string; };
  entityType: string;
  entityId: string | null;
  description: string;
  amount: number | null;
  type: string | null;
  effectiveDate: string | null;
  timestamp: string;
  oldValues?: any;
  newValues?: any;
}

interface AuditLogDetailsProps {
  log: AuditLog | null;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(dateStr: string, locale: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.round(diff / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-FR" : "en-US", { numeric: "auto", style: "short" });
  if (s < 60) return locale === "ar" ? "الآن" : locale === "fr" ? "à l'instant" : "just now";
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, "minute");
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, "hour");
  const d = Math.round(h / 24);
  if (d < 7) return rtf.format(-d, "day");
  return rtf.format(-Math.round(d / 7), "week");
}

function getActionStyle(action: string) {
  const a = action.toUpperCase();
  if (a.includes("CREATE") || a.includes("ADD") || a.includes("POST"))
    return { color: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-200", dot: "bg-emerald-500" };
  if (a.includes("UPDATE") || a.includes("MARK") || a.includes("EDIT"))
    return { color: "text-amber-700", bg: "bg-amber-100", border: "border-amber-200", dot: "bg-amber-500" };
  if (a.includes("DELETE") || a.includes("REMOVE"))
    return { color: "text-rose-700", bg: "bg-rose-100", border: "border-rose-200", dot: "bg-rose-500" };
  return { color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200", dot: "bg-slate-400" };
}

function getStatusStyle(status: string) {
  const s = status.toUpperCase();
  if (s === "PAID") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (s === "PARTIAL") return "bg-amber-100 text-amber-700 border-amber-200";
  if (s === "PENDING") return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function extractMeta(desc: string, locale: string) {
  const status = desc.match(/status[:\s]+(\w+)/i)?.[1]?.toUpperCase() ?? null;
  const periodMatch = desc.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  let period = periodMatch ? periodMatch[0] : (desc.match(/\((\d{1,2}\/\d{4})\)/)?.[0]?.replace(/[()]/g, "") ?? null);
  
  if (periodMatch && locale !== "en") {
    const monthMap: Record<string, string> = {
      "January": locale === "ar" ? "جانفي" : "Janvier",
      "February": locale === "ar" ? "فيفري" : "Février",
      "March": locale === "ar" ? "مارس" : "Mars",
      "April": locale === "ar" ? "أفريل" : "Avril",
      "May": locale === "ar" ? "ماي" : "Mai",
      "June": locale === "ar" ? "جوان" : "Juin",
      "July": locale === "ar" ? "جويلية" : "Juillet",
      "August": locale === "ar" ? "أوت" : "Août",
      "September": locale === "ar" ? "سبتمبر" : "Septembre",
      "October": locale === "ar" ? "أكتوبر" : "Octobre",
      "November": locale === "ar" ? "نوفمبر" : "Novembre",
      "December": locale === "ar" ? "ديسمبر" : "Décembre"
    };
    const m = monthMap[periodMatch[1].charAt(0).toUpperCase() + periodMatch[1].slice(1).toLowerCase()] || periodMatch[1];
    period = `${m} ${periodMatch[2]}`;
  }

  const category = desc.match(/category[:\s]+([A-Za-z\s]+?)(?:\)|,|$)/i)?.[1]?.trim() ?? null;
  return { status, period, category };
}

function getEntityLink(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  const lower = entityType.toLowerCase();
  if (lower.includes("teacher")) return `/list/teachers`;
  if (lower.includes("student")) return `/list/students`;
  if (lower.includes("income")) return `/list/incomes`;
  if (lower.includes("expense")) return `/list/expenses`;
  if (lower.includes("staff")) return `/list/staff`;
  if (lower.includes("payment")) return `/list/payments-partial`;
  return null;
}

function formatVal(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    try { return new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
    catch { return val; }
  }
  if (typeof val === "object") { try { return JSON.stringify(val); } catch { return String(val); } }
  return String(val);
}

// ── Component ─────────────────────────────────────────────────────────────────
const AuditLogDetails: React.FC<AuditLogDetailsProps> = ({ log, onClose }) => {
  const [showChanges, setShowChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t, locale } = useLanguage();
  const dateLocale = locale === "ar" ? "ar-TN-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US";

  if (!log) return null;

  const isIncome = log.type === "income";
  const performer = log.performer;
  const isAI = log.performedBy.toLowerCase().includes("ai") || log.performedBy.toLowerCase().includes("zbiba");
  const isSystem = !isAI && (!performer?.name || log.performedBy === "system" || log.performedBy === "unknown");
  const actionStyle = getActionStyle(log.action);
  const entityLink = getEntityLink(log.entityType, log.entityId);
  const meta = extractMeta(log.description, locale);

  // Strip dollar signs, trim trailing "Status: X" from visible text
  const cleanDesc = log.description
    .replace(/\$(\d+(\.\d+)?)/g, "$1 DT")
    .replace(/[\.\s]*status[:\s]+\w+[\.\s]*/gi, " ")
    .trim()
    .replace(/\s{2,}/g, " ");

  // Build diff list
  const oldV = log.oldValues || {};
  const newV = log.newValues || {};
  const diffKeys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]))
    .filter(k => !["id", "createdAt", "updatedAt", "schoolId", "studentId", "teacherId", "staffId"].includes(k))
    .filter(k => formatVal(oldV[k]) !== formatVal(newV[k]));

  const handleCopy = () => {
    if (!log.entityId) return;
    navigator.clipboard.writeText(log.entityId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 240 }}
          className="relative w-full max-w-md bg-white shadow-2xl h-full flex flex-col border-l border-slate-200"
        >

          {/* ── HEADER ──────────────────────────────────────────────────────── */}
          <div className="px-5 pt-5 pb-4 border-b border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${actionStyle.dot}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${actionStyle.bg} ${actionStyle.color} ${actionStyle.border}`}>
                      {(t as any).auditLogPage?.actions?.[log.action] || log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold">{(t as any).auditLogPage?.entities?.[log.entityType] || log.entityType}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Clock size={10} className="text-slate-400" />
                    <span className="text-[11px] text-slate-500">
                      {new Date(log.timestamp).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}
                      {locale === "ar" ? "، " : locale === "fr" ? " à " : " at "}
                      {new Date(log.timestamp).toLocaleTimeString(dateLocale, { hour: "numeric", minute: "2-digit", hour12: false })}
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-500">· {relativeTime(log.timestamp, locale)}</span>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── BODY ────────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">

            {/* ① AMOUNT — biggest visual, shown first */}
            {log.amount !== null && (
              <div className={`mx-5 mt-4 px-5 py-4 rounded-2xl border flex items-center justify-between ${
                isIncome ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
              }`}>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>
                    {isIncome ? ((t as any).auditLogPage?.details?.income || "Income") : ((t as any).auditLogPage?.details?.expense || "Expense")}
                  </p>
                  <p className={`text-4xl font-black tracking-tight mt-0.5 ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                    {isIncome ? "+" : "−"}{log.amount.toLocaleString()}
                    <span className="text-xl font-bold ml-1.5">DT</span>
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                  isIncome ? "bg-emerald-100 border-emerald-200 text-emerald-600" : "bg-rose-100 border-rose-200 text-rose-600"
                }`}>
                  <Banknote size={22} />
                </div>
              </div>
            )}

            {/* ② META CHIPS — status, period, category */}
            {(meta.status || meta.period || meta.category || log.entityType) && (
              <div className="mx-5 mt-3 flex flex-wrap gap-2">
                {meta.status && (
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getStatusStyle(meta.status)}`}>
                    {meta.status}
                  </span>
                )}
                {meta.period && (
                  <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                    {meta.period}
                  </span>
                )}
                {meta.category && (
                  <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                    {meta.category}
                  </span>
                )}
                <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  {(t as any).auditLogPage?.entities?.[log.entityType] || log.entityType}
                  {log.entityId && <span className="ml-1 opacity-50">#{log.entityId}</span>}
                </span>
              </div>
            )}

            {/* ③ DESCRIPTION — clean short text */}
            <div className="mx-5 mt-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-sm text-slate-600 leading-relaxed">{cleanDesc}</p>
            </div>

            {/* ④ PERFORMER — compact single row */}
            <div className="mx-5 mt-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{(t as any).auditLogPage?.details?.performedBy || "Performed by"}</p>
              {isAI ? (
                <div className="flex items-center gap-3 p-3 bg-indigo-950 rounded-xl border border-indigo-900">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-none">{(t as any).auditLogPage?.details?.aiCopilot || "zbiba (AI Copilot)"}</p>
                    <p className="text-[10px] text-indigo-300 mt-0.5">{(t as any).auditLogPage?.details?.autonomousAiAgent || "Autonomous AI Agent"}</p>
                  </div>
                  <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">{(t as any).auditLogPage?.details?.ai || "AI"}</span>
                </div>
              ) : isSystem ? (
                <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-xl border border-slate-200">
                  <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <Bot size={16} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600 leading-none">{(t as any).auditLogPage?.details?.systemProcess || "System Process"}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{(t as any).auditLogPage?.details?.internalAction || "Internal automated action"}</p>
                  </div>
                  <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-black bg-slate-200 text-slate-500 border border-slate-300 uppercase">{(t as any).auditLogPage?.details?.auto || "Auto"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="relative w-9 h-9 flex-shrink-0">
                    <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 relative">
                      <Image src={performer?.avatar || "/avatar.png"} alt="" fill className="object-cover" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 leading-none truncate">{performer?.name || log.performedBy}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{performer?.email || log.performedBy}</p>
                  </div>
                  {performer?.role && (
                    <span className="ml-auto flex-shrink-0 px-2 py-0.5 rounded text-[9px] font-black bg-slate-900 text-white uppercase">
                      {performer.role}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ⑤ ENTITY ID + LINK */}
            {log.entityId && (
              <div className="mx-5 mt-3 flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex-shrink-0">{(t as any).auditLogPage?.details?.id || "ID"}</span>
                <span className="font-mono text-xs text-slate-600 flex-1 truncate">{log.entityId}</span>
                <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0">
                  {copied
                    ? <><Check size={11} className="text-emerald-500" /><span className="text-emerald-500">{(t as any).auditLogPage?.details?.copied || "Copied"}</span></>
                    : <><Copy size={11} /><span>{(t as any).auditLogPage?.details?.copy || "Copy"}</span></>
                  }
                </button>
                {entityLink && (
                  <Link href={entityLink} onClick={onClose} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex-shrink-0 ml-1 pl-2 border-l border-slate-200">
                    {(t as any).auditLogPage?.details?.open || "Open"} <ExternalLink size={10} />
                  </Link>
                )}
              </div>
            )}

            {/* ⑥ DATES */}
            <div className="mx-5 mt-3 grid grid-cols-2 gap-2">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  <Clock size={10} /> {(t as any).auditLogPage?.details?.logged || "Logged"}
                </div>
                <p className="text-xs font-bold text-slate-700">
                  {new Date(log.timestamp).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}
                </p>
                <p className="text-[10px] text-indigo-500 font-semibold mt-0.5">{relativeTime(log.timestamp, locale)}</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  <Calendar size={10} /> {(t as any).auditLogPage?.details?.effective || "Effective"}
                </div>
                <p className="text-xs font-bold text-slate-700">
                  {log.effectiveDate
                    ? new Date(log.effectiveDate).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
                    : ((t as any).auditLogPage?.details?.immediate || "Immediate")}
                </p>
              </div>
            </div>

            {/* ⑦ FIELD CHANGES — collapsible */}
            {diffKeys.length > 0 && (
              <div className="mx-5 mt-3">
                <button
                  onClick={() => setShowChanges(v => !v)}
                  className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">{(t as any).auditLogPage?.details?.fieldChanges || "Field Changes"}</span>
                    <span className="text-[10px] font-black text-white bg-slate-500 px-1.5 py-0.5 rounded-full leading-none">
                      {diffKeys.length}
                    </span>
                  </div>
                  {showChanges ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </button>

                {showChanges && (
                  <div className="mt-1 bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {diffKeys.map(key => (
                      <div key={key} className="px-3 py-2.5 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 w-20 flex-shrink-0 uppercase tracking-wide">
                          {FIELD_LABELS[key] ?? key}
                        </span>
                        <span className="text-[10px] font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded flex-1 truncate">
                          {formatVal(oldV[key])}
                        </span>
                        <ArrowRight size={10} className="text-slate-300 flex-shrink-0" />
                        <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex-1 truncate">
                          {formatVal(newV[key])}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="h-4" />
          </div>

          {/* ── FOOTER ──────────────────────────────────────────────────────── */}
          <div className="px-5 py-4 bg-white border-t border-slate-100">
            <button
              onClick={onClose}
              className="w-full bg-slate-900 text-white rounded-xl py-3 font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 active:scale-[0.98] transition-all"
            >
              {(t as any).auditLogPage?.details?.close || "Close"}
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AuditLogDetails;
