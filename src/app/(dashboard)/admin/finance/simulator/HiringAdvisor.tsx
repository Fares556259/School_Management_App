"use client";

import { useMemo, useState } from "react";
import {
  Users, TrendingUp, TrendingDown, Target, AlertTriangle,
  CheckCircle2, XCircle, ChevronUp, ChevronDown, Banknote,
  UserPlus, GraduationCap, Minus, Plus, ArrowRight, Info,
  FileText,
} from "lucide-react";
import jsPDF from "jspdf";

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface SimulatorBaseline {
  levels: { id: number; name: string; tuitionFee: number; studentCount: number }[];
  payroll: { teachers: number; staff: number; total: number; teacherCount: number; staffCount: number };
  monthlyOverhead: number;
  cumulativeReserves: number;
}

interface Autofill {
  collectionRate: number;
  registrationPerMonth: number;
  transportIncomePerMonth: number;
  cafeteriaPerMonth: number;
  extracurricularPerMonth: number;
  rentPerMonth: number;
  electricityPerMonth: number;
  waterPerMonth: number;
  internetPerMonth: number;
  fuelPerMonth: number;
  busMaintPerMonth: number;
  materialsPerMonth: number;
  maintenancePerMonth: number;
  marketingPerMonth: number;
  adminPerMonth: number;
  insurancePerMonth: number;
  miscPerMonth: number;
}

interface HiringAdvisorProps {
  baseline: SimulatorBaseline;
  autofill?: Autofill;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function fmt(n: number): string {
  return Math.floor(n).toLocaleString();
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/* ─── Component ───────────────────────────────────────────────────────────── */
export default function HiringAdvisor({ baseline, autofill }: HiringAdvisorProps) {
  const af = autofill;

  // Derived baseline data
  const totalStudents = baseline.levels.reduce((s, l) => s + l.studentCount, 0) || 1;
  const avgTuition = Math.floor(
    baseline.levels.reduce((s, l) => s + (l.studentCount > 0 ? l.tuitionFee * l.studentCount : 0), 0) / totalStudents
  ) || 450;
  const avgTeacherSalary = baseline.payroll.teacherCount > 0
    ? Math.floor(baseline.payroll.teachers / baseline.payroll.teacherCount)
    : 1200;

  const collectionRate = (af?.collectionRate ?? 90) / 100;
  const revenuePerStudent = avgTuition * collectionRate;

  const otherIncome = (af?.registrationPerMonth ?? 0) +
    (af?.transportIncomePerMonth ?? 0) +
    (af?.cafeteriaPerMonth ?? 0) +
    (af?.extracurricularPerMonth ?? 0);

  const totalOverhead = (af?.rentPerMonth ?? 0) + (af?.electricityPerMonth ?? 0) +
    (af?.waterPerMonth ?? 0) + (af?.internetPerMonth ?? 0) + (af?.fuelPerMonth ?? 0) +
    (af?.busMaintPerMonth ?? 0) + (af?.materialsPerMonth ?? 0) + (af?.maintenancePerMonth ?? 0) +
    (af?.marketingPerMonth ?? 0) + (af?.adminPerMonth ?? 0) + (af?.insurancePerMonth ?? 0) +
    (af?.miscPerMonth ?? 0);

  const currentRevenue = totalStudents * revenuePerStudent + otherIncome;
  const currentExpenses = baseline.payroll.total + totalOverhead;
  const currentProfit = currentRevenue - currentExpenses;
  const currentMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;
  const currentBreakEven = revenuePerStudent > 0 ? Math.ceil((currentExpenses - otherIncome) / revenuePerStudent) : 0;

  // ── Controls ───────────────────────────────────────────────────────────────
  const [newTeachers, setNewTeachers] = useState(1);
  const [salary, setSalary] = useState(avgTeacherSalary);
  const [targetMargin, setTargetMargin] = useState(15);
  const [showBaseline, setShowBaseline] = useState(false);

  // ── Live calculations ──────────────────────────────────────────────────────
  const results = useMemo(() => {
    const additionalCost = newTeachers * salary;
    const newExpenses = currentExpenses + additionalCost;
    const newProfit = currentRevenue - newExpenses;
    const newMargin = currentRevenue > 0 ? (newProfit / currentRevenue) * 100 : 0;
    const marginDelta = newMargin - currentMargin;
    const newBreakEven = revenuePerStudent > 0 ? Math.ceil((newExpenses - otherIncome) / revenuePerStudent) : 0;
    const breakEvenDelta = newBreakEven - currentBreakEven;

    let verdict: "feasible" | "tight" | "not_feasible";
    if (newMargin >= targetMargin) verdict = "feasible";
    else if (newMargin > 0) verdict = "tight";
    else verdict = "not_feasible";

    const budgetForHire = currentRevenue * (1 - targetMargin / 100) - currentExpenses;
    const maxAffordableSalary = newTeachers > 0 ? Math.floor(budgetForHire / newTeachers) : 0;

    const tm = targetMargin / 100;
    const studentsNeeded = revenuePerStudent > 0
      ? Math.max(0, Math.ceil((newExpenses - (1 - tm) * currentRevenue) / ((1 - tm) * revenuePerStudent)))
      : 0;

    const salaryMin = 0;
    const salaryMax = Math.max(0, maxAffordableSalary);
    const annualCost = additionalCost * 12;

    return {
      additionalCost, newExpenses, newProfit, newMargin, marginDelta,
      newBreakEven, breakEvenDelta, verdict, maxAffordableSalary,
      studentsNeeded, salaryMin, salaryMax, annualCost,
    };
  }, [newTeachers, salary, targetMargin, currentRevenue, currentExpenses, currentMargin, currentBreakEven, revenuePerStudent, otherIncome]);

  // ── Salary position within safe zone ───────────────────────────────────────
  const salaryBarMax = Math.max(results.salaryMax, salary, avgTeacherSalary) * 1.3 || 1;
  const salaryPct = clamp((salary / salaryBarMax) * 100, 0, 100);
  const safeZonePct = clamp((results.salaryMax / salaryBarMax) * 100, 0, 100);
  const isInSafeZone = salary <= results.salaryMax && results.salaryMax > 0;

  // ── Verdict styling (Webflow strict colors) ──────────────────────────────
  const verdictConfig = {
    feasible: {
      bg: "bg-[#00d722]", text: "text-[#080808]", border: "border-transparent",
      icon: <CheckCircle2 size={24} className="stroke-2" />, label: "FEASIBLE",
      desc: `Hiring ${newTeachers} teacher${newTeachers > 1 ? "s" : ""} at ${fmt(salary)} DT keeps margin above ${targetMargin}%.`,
    },
    tight: {
      bg: "bg-[#ffae13]", text: "text-[#080808]", border: "border-transparent",
      icon: <AlertTriangle size={24} className="stroke-2" />, label: "TIGHT",
      desc: `You stay profitable but fall below the ${targetMargin}% target. Consider enrolling more students.`,
    },
    not_feasible: {
      bg: "bg-[#ee1d36]", text: "text-white", border: "border-transparent",
      icon: <XCircle size={24} className="stroke-2" />, label: "NOT FEASIBLE",
      desc: `This hire pushes you into a deficit. Lower salary or increase enrollment.`,
    },
  };
  const v = verdictConfig[results.verdict];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8 items-start pb-20">
      {/* ══════════════ LEFT: Context + Controls ═══════════════════════════ */}
      <div className="space-y-6">

        {/* ── Current Baseline ────────────────────────────────────────────── */}
        <div className="bg-[#ffffff] rounded-[8px] border border-[#d8d8d8] overflow-hidden">
          <button
            onClick={() => setShowBaseline(b => !b)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#f9f9f9] transition-colors"
          >
            <div className="flex items-center gap-3">
              <TrendingUp size={16} className="text-[#080808]" />
              <div className="text-left">
                <p className="text-[16px] font-semibold text-[#080808] tracking-[-0.16px]">Current Baseline</p>
                <p className="text-[14px] text-[#5a5a5a] mt-0.5">Auto-synced from database</p>
              </div>
            </div>
            {showBaseline ? <ChevronUp size={16} className="text-[#5a5a5a]" /> : <ChevronDown size={16} className="text-[#5a5a5a]" />}
          </button>

          <div className="px-6 pb-5 grid grid-cols-2 gap-4 border-t border-[#d8d8d8] pt-5">
            <div>
              <p className="text-[12px] font-medium text-[#5a5a5a] uppercase tracking-[0.6px] mb-1">Revenue</p>
              <p className="text-[20px] font-semibold text-[#080808] tabular-nums">{fmt(currentRevenue)} DT</p>
            </div>
            <div>
              <p className="text-[12px] font-medium text-[#5a5a5a] uppercase tracking-[0.6px] mb-1">Expenses</p>
              <p className="text-[20px] font-semibold text-[#080808] tabular-nums">{fmt(currentExpenses)} DT</p>
            </div>
            <div>
              <p className="text-[12px] font-medium text-[#5a5a5a] uppercase tracking-[0.6px] mb-1">Margin</p>
              <p className={`text-[20px] font-semibold tabular-nums ${currentMargin >= targetMargin ? "text-[#00d722]" : "text-[#080808]"}`}>
                {currentMargin.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[12px] font-medium text-[#5a5a5a] uppercase tracking-[0.6px] mb-1">Break-even</p>
              <p className="text-[20px] font-semibold text-[#080808] tabular-nums">{currentBreakEven} <span className="text-[14px] font-normal text-[#5a5a5a]">kids</span></p>
            </div>
          </div>

          {showBaseline && (
            <div className="px-6 pb-6 border-t border-[#d8d8d8] pt-5 space-y-3">
              <DetailRow label="Total students" value={totalStudents.toString()} />
              <DetailRow label="Avg tuition fee" value={`${fmt(avgTuition)} DT/mo`} />
              <DetailRow label="Collection rate" value={`${(collectionRate * 100).toFixed(0)}%`} />
              <DetailRow label="Current teachers" value={`${baseline.payroll.teacherCount} (${fmt(baseline.payroll.teachers)} DT)`} />
              <DetailRow label="Overhead" value={`${fmt(totalOverhead)} DT/mo`} />
            </div>
          )}
        </div>

        {/* ── Hiring Controls ──────────────────────────────────────────────── */}
        <div className="bg-[#ffffff] rounded-[8px] border border-[#d8d8d8] p-6 space-y-8">
          <div>
            <p className="text-[20px] font-semibold text-[#080808] tracking-[-0.16px] mb-1">Hiring Scenario</p>
            <p className="text-[14px] text-[#5a5a5a]">Adjust inputs to instantly see the financial impact.</p>
          </div>

          <div className="space-y-3">
            <label className="text-[12px] font-medium text-[#080808] uppercase tracking-[0.6px] flex items-center gap-2">
              <Users size={14} /> New Teachers
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setNewTeachers(t => Math.max(1, t - 1))}
                className="w-10 h-10 rounded-[4px] border border-[#d8d8d8] flex items-center justify-center text-[#080808] hover:bg-[#f5f5f5]"
              >
                <Minus size={16} />
              </button>
              <div className="flex-1 text-center">
                <span className="text-[32px] font-semibold text-[#080808] tabular-nums">{newTeachers}</span>
              </div>
              <button
                onClick={() => setNewTeachers(t => Math.min(10, t + 1))}
                className="w-10 h-10 rounded-[4px] border border-[#d8d8d8] flex items-center justify-center text-[#080808] hover:bg-[#f5f5f5]"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[12px] font-medium text-[#080808] uppercase tracking-[0.6px] flex items-center gap-2">
              <Banknote size={14} /> Monthly Salary (per teacher)
            </label>
            <div className="relative">
              <input
                type="number" min={0} step={50} value={salary}
                onChange={(e) => setSalary(Math.max(0, Number(e.target.value)))}
                className="w-full bg-[#ffffff] border border-[#d8d8d8] rounded-[4px] px-4 py-3 text-[16px] font-medium text-[#080808] pr-16 focus:outline-none focus:border-[#080808]"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#5a5a5a]">DT</span>
            </div>
            <p className="text-[12px] text-[#5a5a5a] flex items-center gap-1.5">
              <Info size={12} /> Avg existing salary: {fmt(avgTeacherSalary)} DT
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[12px] font-medium text-[#080808] uppercase tracking-[0.6px] flex items-center gap-2">
                <Target size={14} /> Target Margin
              </label>
              <span className="text-[16px] font-semibold text-[#080808] tabular-nums">{targetMargin}%</span>
            </div>
            <input
              type="range" min={5} max={40} step={1} value={targetMargin}
              onChange={(e) => setTargetMargin(Number(e.target.value))}
              className="w-full h-1 bg-[#d8d8d8] rounded-full appearance-none outline-none cursor-pointer accent-[#080808]"
            />
          </div>
        </div>

        <button
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#ffffff] border border-[#d8d8d8] hover:bg-[#f5f5f5] text-[#080808] rounded-[4px] font-medium text-[16px] transition-colors"
        >
          <FileText size={16} /> Export Report
        </button>
      </div>

      {/* ══════════════ RIGHT: Live Results ════════════════════════════════ */}
      <div className="space-y-6">

        {/* ── Verdict Banner ────────────────────────────────────────────── */}
        <div className={`${v.bg} ${v.border} ${v.text} rounded-[8px] p-6 flex items-start gap-5 shadow-[0_3px_7px_rgba(0,0,0,0.04)]`}>
          <div className="mt-0.5">{v.icon}</div>
          <div className="flex-1">
            <div className="flex items-baseline gap-3">
              <h3 className="text-[20px] font-semibold tracking-[-0.16px]">{v.label}</h3>
              <span className="text-[14px] font-medium opacity-80">— {results.newMargin.toFixed(1)}% final margin</span>
            </div>
            <p className="text-[16px] mt-2 leading-relaxed opacity-90">{v.desc}</p>
          </div>
        </div>

        {/* ── KPI Grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-6">
          
          {/* Margin Shift */}
          <div className="bg-[#ffffff] rounded-[8px] border border-[#d8d8d8] p-6">
            <p className="text-[12px] font-medium text-[#5a5a5a] uppercase tracking-[0.6px] mb-4">Margin Impact</p>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[28px] font-semibold text-[#080808] tabular-nums">{currentMargin.toFixed(1)}<span className="text-[16px] text-[#5a5a5a]">%</span></p>
              </div>
              <ArrowRight size={20} className="text-[#d8d8d8]" />
              <div>
                <p className={`text-[28px] font-semibold tabular-nums ${results.newMargin >= targetMargin ? "text-[#00d722]" : results.newMargin > 0 ? "text-[#ffae13]" : "text-[#ee1d36]"}`}>
                  {results.newMargin.toFixed(1)}<span className="text-[16px]">%</span>
                </p>
              </div>
            </div>
            <p className="text-[14px] text-[#5a5a5a] mt-2">
              Drop of {Math.abs(results.marginDelta).toFixed(1)} points
            </p>
          </div>

          {/* Break-even Shift */}
          <div className="bg-[#ffffff] rounded-[8px] border border-[#d8d8d8] p-6">
            <p className="text-[12px] font-medium text-[#5a5a5a] uppercase tracking-[0.6px] mb-4">Break-even Point</p>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[28px] font-semibold text-[#080808] tabular-nums">{currentBreakEven}</p>
              </div>
              <ArrowRight size={20} className="text-[#d8d8d8]" />
              <div>
                <p className="text-[28px] font-semibold text-[#080808] tabular-nums">{results.newBreakEven}</p>
              </div>
            </div>
            <p className="text-[14px] text-[#5a5a5a] mt-2">
              Needs <span className="font-semibold text-[#080808]">+{results.breakEvenDelta}</span> students
            </p>
          </div>
        </div>

        {/* ── Salary Safe Zone ─────────────────────────────────────────── */}
        <div className="bg-[#ffffff] rounded-[8px] border border-[#d8d8d8] p-6">
          <p className="text-[12px] font-medium text-[#5a5a5a] uppercase tracking-[0.6px] mb-4">Salary Affordability</p>
          <div className="flex items-baseline gap-2 mb-6">
            <p className="text-[16px] text-[#080808]">Maximum affordable salary for {targetMargin}% margin:</p>
            <span className={`text-[24px] font-semibold tabular-nums ${results.maxAffordableSalary > 0 ? "text-[#00d722]" : "text-[#ee1d36]"}`}>
              {results.maxAffordableSalary > 0 ? fmt(results.maxAffordableSalary) : "0"} <span className="text-[16px]">DT</span>
            </span>
          </div>

          <div className="relative h-[8px] bg-[#f5f5f5] rounded-[4px] overflow-visible">
            {/* Safe zone */}
            <div className="absolute h-full bg-[#00d722] rounded-[4px]" style={{ width: `${safeZonePct}%` }} />
            {/* Current marker */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-[16px] h-[16px] rounded-full border-[3px] border-[#ffffff] shadow-[0_2px_4px_rgba(0,0,0,0.2)] ${isInSafeZone ? "bg-[#080808]" : "bg-[#ee1d36]"}`}
              style={{ left: `${clamp(salaryPct - 1, 0, 98)}%` }}
            />
          </div>
          <div className="flex justify-between mt-3 text-[12px] text-[#5a5a5a] font-medium uppercase tracking-[0.6px]">
            <span>0 DT</span>
            <span className="text-[#00d722]">Safe Limit</span>
            <span>{fmt(salaryBarMax)} DT</span>
          </div>
        </div>

        {/* ── Target Enrollment ────────────────────────────────────────── */}
        <div className="bg-[#ffffff] rounded-[8px] border border-[#d8d8d8] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)] border-l-4 border-l-[#7a3dff]">
          <div className="flex items-start gap-4">
            <GraduationCap size={24} className="text-[#7a3dff] mt-1" />
            <div>
              <p className="text-[16px] font-semibold text-[#080808]">To hit your {targetMargin}% margin goal</p>
              <div className="mt-2 text-[16px] text-[#363636]">
                {results.studentsNeeded > 0 ? (
                  <>
                    You must enroll <span className="text-[24px] font-semibold tabular-nums text-[#080808]">{results.studentsNeeded}</span> more student{results.studentsNeeded > 1 ? "s" : ""} to cover this salary safely.
                  </>
                ) : (
                  "No additional enrollment needed. You are well within budget."
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[14px] text-[#5a5a5a]">{label}</span>
      <span className="text-[14px] font-medium text-[#080808]">{value}</span>
    </div>
  );
}
