"use client";

import { useState, useRef, useMemo } from "react";
import jsPDF from "jspdf";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Calculator, TrendingUp, TrendingDown, Users, Target, Save, Zap,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle,
  Bus, UtensilsCrossed, Star, Building2, Gift, Shirt, Wrench,
  Lightbulb, Megaphone, FileText, Shield, Package, GraduationCap,
  BarChart3, RefreshCw, Crosshair,
} from "lucide-react";

/* ─── types ── */
interface SimulatorBaseline {
  levels: { id: number; name: string; tuitionFee: number; studentCount: number }[];
  payroll: { teachers: number; staff: number; total: number; teacherCount: number; staffCount: number };
  monthlyOverhead: number;
  cumulativeReserves: number;
}
interface Scenario {
  id: string; name: string; tuitionAdjust: number; salaryAdjust: number;
  overheadAdjust: number; targetStudents: number; description?: string | null; updatedAt: Date;
}
interface CalcResult {
  totalIncome: number; totalExpenses: number; netProfit: number;
  margin: number; perStudent: number; breakEven: number;
  status: "safe" | "warning" | "danger";
  salaryRatio: number; expenseRatio: number; otherExpenses: number;
  incomeBreakdown: { label: string; value: number }[];
  expenseBreakdown: { label: string; value: number }[];
}

/* ─── Input ─── */
function SimInput({ label, value, onChange, unit, hint, icon }: {
  label: string; value: number; onChange: (v: number) => void;
  unit: string; hint?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-slate-300">{icon}</span>}
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{label}</label>
      </div>
      <div className="relative">
        <input
          type="number" min={0} value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-3 text-sm font-semibold text-slate-800 pr-16
                     focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300 transition-all
                     hover:border-slate-300 placeholder:text-slate-300"
        />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded">{unit}</span>
      </div>
      {hint && <p className="text-[10px] text-slate-400 leading-relaxed">{hint}</p>}
    </div>
  );
}

/* ─── Section ─── */
function SectionCard({ title, subtitle, accent, bg, children, total, icon, defaultOpen = true }: {
  title: string; subtitle: string; accent: string; bg: string; children: React.ReactNode;
  total?: number; icon: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
        <div className="flex items-center gap-3.5">
          <div className={`p-2.5 rounded-xl ${bg}`}>{icon}</div>
          <div className="text-left">
            <p className="font-bold text-slate-800">{title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {total !== undefined && total > 0 && (
            <span className={`text-sm font-bold tabular-nums px-3 py-1.5 rounded-lg ${bg} ${accent}`}>
              {total.toLocaleString()} TND
            </span>
          )}
          <span className="text-slate-300">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-50">
          <div className="px-6 py-6 space-y-6">{children}</div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-group ─── */
function Group({ label, children, cols = 3 }: { label: string; children: React.ReactNode; cols?: number }) {
  const grid = cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-5 space-y-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">{label}</p>
      <div className={`grid grid-cols-1 ${grid} gap-4`}>{children}</div>
    </div>
  );
}

/* ─── Donut ─── */
function MarginDonut({ margin, status }: { margin: number; status: "safe" | "warning" | "danger" }) {
  const color = status === "safe" ? "#16a34a" : status === "warning" ? "#d97706" : "#dc2626";
  const pct = Math.min(100, Math.max(0, margin));
  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={[{ value: pct }, { value: 100 - pct }]} cx="50%" cy="50%"
            innerRadius={44} outerRadius={58} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
            <Cell fill={color} />
            <Cell fill="#f1f5f9" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-slate-800 tabular-nums leading-none">{margin.toFixed(1)}%</span>
        <span className="text-[10px] text-slate-400 font-medium mt-0.5">margin</span>
      </div>
    </div>
  );
}

/* ─── Bar Row ─── */
function BarRow({ label, value, max, color, dot }: {
  label: string; value: number; max: number; color: string; dot: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-sm text-slate-600 w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-slate-700 tabular-nums w-28 text-right">{value.toLocaleString()} TND</span>
    </div>
  );
}

/* ─── Chip ─── */
function ChipCard({ label, value, status }: { label: string; value: string; status: "ok" | "warn" | "bad" }) {
  const styles = {
    ok:   "bg-green-50  border-green-100  text-green-700",
    warn: "bg-amber-50  border-amber-100  text-amber-700",
    bad:  "bg-red-50    border-red-100    text-red-600",
  }[status];
  return (
    <div className={`border rounded-xl p-4 ${styles}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60 mb-1">{label}</p>
      <p className="text-sm font-bold leading-snug">{value}</p>
    </div>
  );
}

/* ─── Main ─── */
export default function SimulatorInterface({ baseline }: {
  baseline: SimulatorBaseline; initialScenarios: Scenario[];
}) {
  const resultRef = useRef<HTMLDivElement>(null);

  const avgTuition = Math.floor(
    baseline.levels.reduce((s, l) => s + (l.studentCount > 0 ? l.tuitionFee : 0), 0) /
    (baseline.levels.filter(l => l.studentCount > 0).length || 1)
  ) || 450;
  const totalStudents = baseline.levels.reduce((s, l) => s + l.studentCount, 0) || 100;

  // Income
  const [iTuition, setITuition] = useState(avgTuition);
  const [iStudents, setIStudents] = useState(totalStudents);
  const [iCollectionRate, setICollectionRate] = useState(95);
  const [iRegistration, setIRegistration] = useState(0);
  const [iTransportFee, setITransportFee] = useState(0);
  const [iTransportStudents, setITransportStudents] = useState(0);
  const [iCafeteria, setICafeteria] = useState(0);
  const [iExtra, setIExtra] = useState(0);
  const [iUniforms, setIUniforms] = useState(0);
  const [iFacility, setIFacility] = useState(0);
  const [iDonations, setIDonations] = useState(0);

  // Expenses
  const [eSalaries, setESalaries] = useState(baseline.payroll.total || 0);
  const [eRent, setERent] = useState(0);
  const [eElectricity, setEElectricity] = useState(0);
  const [eWater, setEWater] = useState(0);
  const [eInternet, setEInternet] = useState(0);
  const [eFuel, setEFuel] = useState(0);
  const [eBusMaint, setEBusMaint] = useState(0);
  const [eDrivers, setEDrivers] = useState(0);
  const [eMaterials, setEMaterials] = useState(0);
  const [eMaintenance, setEMaintenance] = useState(0);
  const [eMarketing, setEMarketing] = useState(0);
  const [eAdmin, setEAdmin] = useState(0);
  const [eInsurance, setEInsurance] = useState(0);
  const [eMisc, setEMisc] = useState(0);

  const [targetMargin, setTargetMargin] = useState(20);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [whatIfLoss, setWhatIfLoss] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const liveIncome = iStudents * iTuition * (iCollectionRate / 100) + iRegistration +
    iTransportStudents * iTransportFee + iCafeteria + iExtra + iUniforms + iFacility + iDonations;
  const liveExpenses = eSalaries + eRent + eElectricity + eWater + eInternet +
    eFuel + eBusMaint + eDrivers + eMaterials + eMaintenance + eMarketing + eAdmin + eInsurance + eMisc;

  const compute = (students: number): CalcResult => {
    const tuitionRev = students * iTuition * (iCollectionRate / 100);
    const transportIncome = iTransportStudents * iTransportFee;
    const totalIncome = tuitionRev + iRegistration + transportIncome + iCafeteria + iExtra + iUniforms + iFacility + iDonations;
    const otherExpenses = eRent + eElectricity + eWater + eInternet + eFuel + eBusMaint + eDrivers + eMaterials + eMaintenance + eMarketing + eAdmin + eInsurance + eMisc;
    const totalExpenses = eSalaries + otherExpenses;
    const netProfit = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const perStudent = students > 0 ? netProfit / students : 0;
    const cpS = iTuition * (iCollectionRate / 100);
    const breakEven = cpS > 0 ? Math.ceil(totalExpenses / cpS) : 0;
    const salaryRatio = totalIncome > 0 ? (eSalaries / totalIncome) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;
    const status: CalcResult["status"] = margin < 0 ? "danger" : margin < targetMargin ? "warning" : "safe";
    return {
      totalIncome, totalExpenses, netProfit, margin, perStudent, breakEven,
      status, salaryRatio, expenseRatio, otherExpenses,
      incomeBreakdown: [
        { label: "Tuition", value: tuitionRev }, { label: "Registration", value: iRegistration },
        { label: "Transport", value: transportIncome }, { label: "Cafeteria", value: iCafeteria },
        { label: "Activities", value: iExtra }, { label: "Uniforms", value: iUniforms },
        { label: "Facility", value: iFacility }, { label: "Donations", value: iDonations },
      ].filter(x => x.value > 0),
      expenseBreakdown: [
        { label: "Salaries", value: eSalaries }, { label: "Rent", value: eRent },
        { label: "Electricity", value: eElectricity }, { label: "Water", value: eWater },
        { label: "Internet", value: eInternet }, { label: "Fuel", value: eFuel },
        { label: "Bus Maint.", value: eBusMaint }, { label: "Drivers", value: eDrivers },
        { label: "Materials", value: eMaterials }, { label: "Maintenance", value: eMaintenance },
        { label: "Marketing", value: eMarketing }, { label: "Admin", value: eAdmin },
        { label: "Insurance", value: eInsurance }, { label: "Misc", value: eMisc },
      ].filter(x => x.value > 0),
    };
  };

  const handleCalculate = () => {
    setWhatIfLoss(0);
    const r = compute(iStudents);
    setResult(r);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  const whatIfResult = useMemo(() => {
    if (!result) return null;
    return compute(Math.max(0, iStudents - whatIfLoss));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatIfLoss, result]);

  const exportToPdf = () => {
    if (!result) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 16;
      const contentW = pageW - margin * 2;
      let y = margin;

      const LINE = 7;
      const addLine = (extra = 0) => { y += LINE + extra; };

      // ── Header ──────────────────────────────────────────
      pdf.setFillColor(124, 58, 237); // purple
      pdf.rect(0, 0, pageW, 22, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("SnapSchool · Financial Scenario Report", margin, 14);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(new Date().toLocaleDateString("fr-TN", { year: "numeric", month: "long", day: "numeric" }), pageW - margin, 14, { align: "right" });
      y = 30;

      // ── Status Banner ────────────────────────────────────
      const statusColors: Record<string, [number, number, number]> = {
        safe:    [240, 253, 244],
        warning: [255, 251, 235],
        danger:  [254, 242, 242],
      };
      const statusTextColors: Record<string, [number, number, number]> = {
        safe:    [22, 163, 74],
        warning: [180, 83, 9],
        danger:  [185, 28, 28],
      };
      const [sr, sg, sb] = statusColors[result.status];
      const [tr, tg, tb] = statusTextColors[result.status];
      pdf.setFillColor(sr, sg, sb);
      pdf.roundedRect(margin, y, contentW, 18, 3, 3, "F");
      pdf.setTextColor(tr, tg, tb);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      const statusLabel = result.status === "safe" ? "Profitable ✓" : result.status === "warning" ? "Margin Too Low ⚠" : "In Deficit ✗";
      pdf.text(statusLabel, margin + 6, y + 7);
      pdf.setFontSize(18);
      pdf.text(`${result.margin.toFixed(1)}%`, pageW - margin - 6, y + 9, { align: "right" });
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const desc = result.status === "safe"
        ? `Margin (${result.margin.toFixed(1)}%) exceeds the ${targetMargin}% target.`
        : result.status === "warning"
        ? `Margin at ${result.margin.toFixed(1)}%, below your ${targetMargin}% target.`
        : `Losing ${Math.abs(result.netProfit).toLocaleString()} TND / month.`;
      pdf.text(desc, margin + 6, y + 14);
      y += 26;

      // ── KPIs ─────────────────────────────────────────────
      const kpiW = (contentW - 6) / 4;
      const kpis = [
        { label: "Total Revenue",   value: `${Math.floor(result.totalIncome).toLocaleString()} TND` },
        { label: "Total Expenses",  value: `${Math.floor(result.totalExpenses).toLocaleString()} TND` },
        { label: "Net Profit",      value: `${Math.floor(result.netProfit).toLocaleString()} TND` },
        { label: "Profit / Student",value: `${Math.floor(result.perStudent).toLocaleString()} TND` },
      ];
      kpis.forEach((k, i) => {
        const x = margin + i * (kpiW + 2);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(x, y, kpiW, 20, 2, 2, "F");
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.text(k.label.toUpperCase(), x + 4, y + 6);
        pdf.setTextColor(30, 41, 59);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.text(k.value, x + 4, y + 14);
      });
      y += 28;

      // ── Section: Financial Breakdown ──────────────────────
      const drawSection = (title: string) => {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, contentW, 8, "F");
        pdf.setTextColor(51, 65, 85);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text(title, margin + 4, y + 5.5);
        y += 10;
      };

      const drawRow = (label: string, value: string, color?: [number, number, number]) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text(label, margin + 4, y);
        if (color) pdf.setTextColor(...color);
        else pdf.setTextColor(30, 41, 59);
        pdf.setFont("helvetica", "bold");
        pdf.text(value, pageW - margin - 4, y, { align: "right" });
        // light divider
        pdf.setDrawColor(241, 245, 249);
        pdf.line(margin, y + 2, pageW - margin, y + 2);
        y += LINE;
      };

      drawSection("Income Breakdown");
      result.incomeBreakdown.forEach(item => {
        drawRow(item.label, `${Math.floor(item.value).toLocaleString()} TND`, [22, 163, 74]);
      });
      drawRow("TOTAL INCOME", `${Math.floor(result.totalIncome).toLocaleString()} TND`, [22, 163, 74]);
      y += 4;

      drawSection("Expense Breakdown");
      result.expenseBreakdown.forEach(item => {
        drawRow(item.label, `${Math.floor(item.value).toLocaleString()} TND`, [220, 38, 38]);
      });
      drawRow("TOTAL EXPENSES", `${Math.floor(result.totalExpenses).toLocaleString()} TND`, [220, 38, 38]);
      y += 4;

      // ── Break-even ────────────────────────────────────────
      drawSection("Break-Even Analysis");
      drawRow("Break-even students required", `${result.breakEven} students`);
      drawRow("Current students", `${iStudents} students`);
      drawRow("Buffer above break-even", `${Math.max(0, iStudents - result.breakEven)} students`);
      y += 4;

      // ── Health Checklist ─────────────────────────────────
      drawSection("Financial Health Checklist");
      const chips = [
        { label: "Margin achieved",  value: `${result.margin.toFixed(1)}% / target ${targetMargin}%`,       ok: result.margin >= targetMargin },
        { label: "Above break-even", value: `${iStudents} / ${result.breakEven} students`,                    ok: iStudents >= result.breakEven },
        { label: "Profit / student", value: `${Math.floor(result.perStudent).toLocaleString()} TND`,          ok: result.perStudent > 0 },
        { label: "Expense ratio",    value: `${result.expenseRatio.toFixed(0)}% of revenue`,                  ok: result.expenseRatio < 80 },
        { label: "Revenue sources",  value: `${result.incomeBreakdown.length} income sources`,                ok: result.incomeBreakdown.length >= 2 },
        { label: "Salary ratio",     value: `${result.salaryRatio.toFixed(0)}%`,                              ok: result.salaryRatio <= 45 },
      ];
      chips.forEach(chip => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(chip.ok ? 21 : 185, chip.ok ? 128 : 28, chip.ok ? 61 : 28);
        pdf.text(chip.ok ? "✓" : "✗", margin + 4, y);
        pdf.setTextColor(71, 85, 105);
        pdf.text(chip.label, margin + 12, y);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 41, 59);
        pdf.text(chip.value, pageW - margin - 4, y, { align: "right" });
        pdf.setDrawColor(241, 245, 249);
        pdf.line(margin, y + 2, pageW - margin, y + 2);
        y += LINE;
      });

      // ── Footer ────────────────────────────────────────────
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, pageH - 12, pageW, 12, "F");
      pdf.setTextColor(148, 163, 184);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text("Generated by SnapSchool Financial Simulator · Confidential", margin, pageH - 5);
      pdf.text(`Target Margin: ${targetMargin}%`, pageW - margin, pageH - 5, { align: "right" });

      pdf.save(`SnapSchool_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setIsExporting(false);
    }
  };

  const sMap = {
    safe:    { banner: "bg-[#f0fdf4] border-green-200",  text: "text-green-700",  label: "Profitable ✓",       desc: (r: CalcResult) => `Margin (${r.margin.toFixed(1)}%) exceeds the ${targetMargin}% target by ${(r.margin - targetMargin).toFixed(1)} pts.` },
    warning: { banner: "bg-amber-50   border-amber-200", text: "text-amber-700", label: "Margin Too Low ⚠",   desc: (r: CalcResult) => `Margin at ${r.margin.toFixed(1)}%, below your ${targetMargin}% target.` },
    danger:  { banner: "bg-red-50     border-red-200",   text: "text-red-700",   label: "In Deficit ✗",        desc: (r: CalcResult) => `Losing ${Math.abs(r.netProfit).toLocaleString()} TND / month. Urgent review.` },
  };

  return (
    <div className="space-y-4 pb-20">

      {/* ── INCOME ──────────────────────────────────────────── */}
      <SectionCard title="Monthly Income" subtitle="All projected revenue sources"
        accent="text-emerald-700" bg="bg-emerald-50"
        icon={<TrendingUp size={17} className="text-emerald-600" />}
        total={Math.floor(liveIncome)}>

        <Group label="1 · Tuition Fees — main source" cols={3}>
          <SimInput label="Avg fee / student" value={iTuition} onChange={setITuition} unit="TND" icon={<GraduationCap size={12} />} hint="Monthly fee per student" />
          <SimInput label="Number of students" value={iStudents} onChange={setIStudents} unit="Students" icon={<Users size={12} />} />
          <SimInput label="Collection rate" value={iCollectionRate} onChange={setICollectionRate} unit="%" icon={<Target size={12} />} hint="% of fees actually collected" />
        </Group>

        <Group label="2 · Registration Fees" cols={2}>
          <SimInput label="Registration / month" value={iRegistration} onChange={setIRegistration} unit="TND" icon={<FileText size={12} />} hint="Annual fee ÷ 12" />
        </Group>

        <Group label="3 · Transportation Fees" cols={2}>
          <SimInput label="Bus subscription / student" value={iTransportFee} onChange={setITransportFee} unit="TND" icon={<Bus size={12} />} />
          <SimInput label="Bus subscribers" value={iTransportStudents} onChange={setITransportStudents} unit="Students" icon={<Users size={12} />} />
        </Group>

        <Group label="4 – 8 · Other Revenue Sources" cols={3}>
          <SimInput label="Cafeteria / Meal plans" value={iCafeteria} onChange={setICafeteria} unit="TND" icon={<UtensilsCrossed size={12} />} />
          <SimInput label="Extracurricular activities" value={iExtra} onChange={setIExtra} unit="TND" icon={<Star size={12} />} hint="Sports, clubs, tutoring" />
          <SimInput label="Uniform sales" value={iUniforms} onChange={setIUniforms} unit="TND" icon={<Shirt size={12} />} />
          <SimInput label="Facility rentals" value={iFacility} onChange={setIFacility} unit="TND" icon={<Building2 size={12} />} hint="After-hours rooms" />
          <SimInput label="Donations / Sponsorships" value={iDonations} onChange={setIDonations} unit="TND" icon={<Gift size={12} />} hint="Less predictable" />
        </Group>
      </SectionCard>

      {/* ── EXPENSES ────────────────────────────────────────── */}
      <SectionCard title="Monthly Expenses" subtitle="Recurring operational costs"
        accent="text-rose-700" bg="bg-rose-50"
        icon={<TrendingDown size={17} className="text-rose-500" />}
        total={Math.floor(liveExpenses)}>

        <Group label="1 · Salaries — biggest cost 💼" cols={2}>
          <SimInput label="Total payroll" value={eSalaries} onChange={setESalaries} unit="TND" icon={<Users size={12} />} hint="Teachers + admin + security + drivers" />
        </Group>

        <Group label="2 – 3 · Rent & Utilities" cols={4}>
          <SimInput label="Rent / Loan payments" value={eRent} onChange={setERent} unit="TND" icon={<Building2 size={12} />} />
          <SimInput label="Electricity" value={eElectricity} onChange={setEElectricity} unit="TND" icon={<Lightbulb size={12} />} />
          <SimInput label="Water" value={eWater} onChange={setEWater} unit="TND" icon={<Wrench size={12} />} />
          <SimInput label="Internet / Phone" value={eInternet} onChange={setEInternet} unit="TND" icon={<Zap size={12} />} />
        </Group>

        <Group label="4 · Transportation Costs" cols={3}>
          <SimInput label="Fuel" value={eFuel} onChange={setEFuel} unit="TND" icon={<Bus size={12} />} />
          <SimInput label="Bus maintenance" value={eBusMaint} onChange={setEBusMaint} unit="TND" icon={<Wrench size={12} />} />
          <SimInput label="Driver wages" value={eDrivers} onChange={setEDrivers} unit="TND" icon={<Users size={12} />} hint="If not already in payroll" />
        </Group>

        <Group label="5 – 10 · Other Operating Costs" cols={3}>
          <SimInput label="Educational materials" value={eMaterials} onChange={setEMaterials} unit="TND" icon={<Package size={12} />} hint="Books, lab, software" />
          <SimInput label="Maintenance & Repairs" value={eMaintenance} onChange={setEMaintenance} unit="TND" icon={<Wrench size={12} />} />
          <SimInput label="Marketing & Advertising" value={eMarketing} onChange={setEMarketing} unit="TND" icon={<Megaphone size={12} />} />
          <SimInput label="Administrative costs" value={eAdmin} onChange={setEAdmin} unit="TND" icon={<FileText size={12} />} hint="Legal, accounting, office" />
          <SimInput label="Insurance" value={eInsurance} onChange={setEInsurance} unit="TND" icon={<Shield size={12} />} />
          <SimInput label="Miscellaneous" value={eMisc} onChange={setEMisc} unit="TND" icon={<Zap size={12} />} hint="Events, trips, unexpected" />
        </Group>
      </SectionCard>

      {/* ── TARGET MARGIN ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-purple-50"><Target size={17} className="text-purple-500" /></div>
          <div>
            <p className="font-bold text-slate-800">Profit Margin Target</p>
            <p className="text-xs text-slate-400 mt-0.5">Your financial safety threshold</p>
          </div>
        </div>
        <div className="max-w-xs">
          <SimInput label="Target margin" value={targetMargin} onChange={setTargetMargin} unit="%" hint="Typical for private schools: 15–30%" />
        </div>
      </div>

      {/* ── CALCULATE ───────────────────────────────────────── */}
      <div className="flex justify-center py-3">
        <button onClick={handleCalculate}
          className="flex items-center gap-3 px-14 py-4 bg-[#7C3AED] hover:bg-[#6D28D9] active:scale-[0.98]
                     text-white rounded-xl font-bold text-sm tracking-wide transition-all shadow-md shadow-purple-200/60">
          <Calculator size={18} />
          Run Simulation
          <BarChart3 size={18} />
        </button>
      </div>

      {/* ══════════ RESULTS ══════════ */}
      {result && (
        <div ref={resultRef} className="space-y-4 animate-in slide-in-from-bottom-6 duration-400">

          {/* What-if */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-50">
              <div className="p-2.5 rounded-xl bg-orange-50"><Crosshair size={16} className="text-orange-500" /></div>
              <div>
                <p className="font-bold text-slate-800">What-if analysis</p>
                <p className="text-xs text-slate-400 mt-0.5">Stress-test your numbers</p>
              </div>
            </div>
            <div className="px-6 py-5 bg-slate-50/50 space-y-3">
              <p className="text-sm text-slate-600">If I lose this many students, my margin becomes:</p>
              <div className="flex items-center gap-4">
                <input type="range" min={0} max={iStudents} step={1} value={whatIfLoss}
                  onChange={e => setWhatIfLoss(Number(e.target.value))}
                  className="flex-1 accent-purple-500 cursor-pointer h-1.5 rounded-full" />
                <span className="text-sm font-bold text-slate-700 tabular-nums min-w-[90px] text-right">
                  -{whatIfLoss} students
                </span>
              </div>
              {whatIfResult && whatIfLoss > 0 && (
                <p className="text-sm text-slate-700">
                  With <strong>{iStudents - whatIfLoss}</strong> students → margin drops to{" "}
                  <strong>{whatIfResult.margin.toFixed(1)}%</strong>
                  {whatIfResult.margin >= targetMargin
                    ? <span className="text-green-600"> — still above your {targetMargin}% target</span>
                    : <span className="text-rose-500"> — below your {targetMargin}% target ⚠️</span>}
                </p>
              )}
            </div>
          </div>

          {/* Status Banner */}
          {(() => {
            const s = sMap[result.status];
            return (
              <div className={`border rounded-2xl px-6 py-5 flex items-center justify-between ${s.banner}`}>
                <div>
                  <p className={`text-xl font-black ${s.text}`}>{s.label}</p>
                  <p className={`text-sm mt-1 ${s.text} opacity-80`}>{s.desc(result)}</p>
                </div>
                <p className={`text-5xl font-black tabular-nums ${s.text}`}>{result.margin.toFixed(1)}%</p>
              </div>
            );
          })()}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total revenue",   value: result.totalIncome,    color: "text-slate-800", sub: "TND / month" },
              { label: "Total expenses",  value: result.totalExpenses,  color: "text-rose-500",  sub: "TND / month" },
              { label: "Net profit",      value: result.netProfit,      color: result.netProfit >= 0 ? "text-green-600" : "text-rose-500", sub: "TND / month" },
              { label: "Profit / student",value: result.perStudent,     color: result.perStudent >= 0 ? "text-green-600" : "text-rose-500", sub: "TND" },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-slate-400 font-medium">{label}</p>
                <p className={`text-2xl font-black tabular-nums mt-2 ${color}`}>{Math.floor(value).toLocaleString()}</p>
                <p className="text-[10px] text-slate-300 uppercase tracking-wide mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Financial Breakdown */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <p className="font-bold text-slate-800 mb-5">Financial breakdown</p>
            <div className="flex items-start gap-8">
              <MarginDonut margin={result.margin} status={result.status} />
              <div className="flex-1 space-y-3.5 pt-1">
                {(() => {
                  const max = Math.max(result.totalIncome, result.totalExpenses, 1);
                  const tuition = result.incomeBreakdown.find(x => x.label === "Tuition")?.value || result.totalIncome;
                  return (
                    <>
                      <BarRow label="Tuition revenue" value={Math.floor(tuition)} max={max} color="bg-green-500" dot="bg-green-500" />
                      <BarRow label="Salaries" value={Math.floor(eSalaries)} max={max} color="bg-rose-400" dot="bg-rose-400" />
                      <BarRow label="Other expenses" value={Math.floor(result.otherExpenses)} max={max} color="bg-slate-300" dot="bg-slate-300" />
                      <BarRow label="Net profit" value={Math.floor(Math.max(0, result.netProfit))} max={max} color="bg-emerald-400" dot="bg-emerald-400" />
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Break-even */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <p className="font-bold text-slate-800 mb-4">Break-even point</p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-black text-slate-800 tabular-nums">{result.breakEven}</span>
              <span className="text-slate-400 font-medium">students minimum</span>
            </div>
            <div className="space-y-2">
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${iStudents >= result.breakEven ? "bg-green-500" : "bg-rose-400"}`}
                  style={{ width: `${Math.min(100, (iStudents / Math.max(result.breakEven, 1)) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-medium pt-0.5">
                <span>0</span>
                <span className="text-slate-600 font-semibold">{result.breakEven} required</span>
                <span>{iStudents} actual</span>
              </div>
              <p className={`text-sm font-semibold pt-1 ${iStudents >= result.breakEven ? "text-green-600" : "text-rose-500"}`}>
                {iStudents >= result.breakEven
                  ? `+${iStudents - result.breakEven} students above break-even — strong buffer`
                  : `${result.breakEven - iStudents} more students needed to break even`}
              </p>
            </div>
          </div>

          {/* Health chips */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <ChipCard label="Margin achieved" value={`${result.margin.toFixed(1)}% / target ${targetMargin}%`}
              status={result.margin >= targetMargin ? "ok" : result.margin > 0 ? "warn" : "bad"} />
            <ChipCard label="Above break-even" value={`${iStudents} / ${result.breakEven} students`}
              status={iStudents >= result.breakEven ? "ok" : "bad"} />
            <ChipCard label="Profit / student" value={`${Math.floor(result.perStudent).toLocaleString()} TND`}
              status={result.perStudent > 100 ? "ok" : result.perStudent > 0 ? "warn" : "bad"} />
            <ChipCard label="Expense ratio" value={`${result.expenseRatio.toFixed(0)}% of revenue`}
              status={result.expenseRatio < 70 ? "ok" : result.expenseRatio < 90 ? "warn" : "bad"} />
            <ChipCard label="Revenue sources" value={result.incomeBreakdown.length <= 1 ? "1 source only" : `${result.incomeBreakdown.length} sources`}
              status={result.incomeBreakdown.length >= 3 ? "ok" : result.incomeBreakdown.length === 2 ? "warn" : "bad"} />
            <ChipCard label="Salary ratio" value={`${result.salaryRatio.toFixed(0)}% ${result.salaryRatio > 45 ? "— above 45% target" : "— healthy"}`}
              status={result.salaryRatio <= 45 ? "ok" : result.salaryRatio <= 60 ? "warn" : "bad"} />
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Reset", icon: <RefreshCw size={14} />, onClick: () => { setResult(null); setWhatIfLoss(0); } },
              { label: "Save scenario", icon: <Save size={14} />, onClick: () => alert("Connect to DB to persist scenarios") },
              { label: isExporting ? "Exporting…" : "PDF report", icon: <FileText size={14} />, onClick: exportToPdf },
            ].map(({ label, icon, onClick }) => (
              <button key={label} onClick={onClick}
                className="flex items-center justify-center gap-2 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-semibold text-sm transition-colors shadow-sm">
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="text-center pt-12">
        <p className="text-[10px] font-medium text-slate-300 uppercase tracking-[0.3em]">
          SnapSchool · Financial Scenario Simulator
        </p>
      </div>
    </div>
  );
}
