"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  ArrowRight,
  Info,
} from "lucide-react";

interface SimulatorBaseline {
  levels: {
    id: number;
    name: string;
    tuitionFee: number;
    studentCount: number;
  }[];
  payroll: {
    teachers: number;
    staff: number;
    total: number;
  };
  monthlyOverhead: number;
}

export default function SimulatorInterface({ baseline }: { baseline: SimulatorBaseline }) {
  // Simulator Modifiers
  const [tuitionAdjust, setTuitionAdjust] = useState(0); // -50 to +100 (%)
  const [salaryAdjust, setSalaryAdjust] = useState(0); // -50 to +100 (%)
  const [overheadAdjust, setOverheadAdjust] = useState(0); // -50 to +100 (%)
  const [targetStudentCount, setTargetStudentCount] = useState(baseline.levels.reduce((s, l) => s + l.studentCount, 0));

  // Current Stats
  const currentTotalStudents = baseline.levels.reduce((acc, curr) => acc + curr.studentCount, 0);
  const currentMonthlyRevenue = baseline.levels.reduce((acc, curr) => acc + (curr.studentCount * curr.tuitionFee), 0);
  const currentMonthlyExpenses = baseline.payroll.total + baseline.monthlyOverhead;
  
  // Simulated Stats
  const tuitionMult = 1 + tuitionAdjust / 100;
  const salaryMult = 1 + salaryAdjust / 100;
  const overheadMult = 1 + overheadAdjust / 100;

  const simMonthlyRevenue = baseline.levels.reduce((acc, curr) => {
    // If student count is adjusted globally, distribute proportionately
    const studentRatio = currentTotalStudents > 0 ? curr.studentCount / currentTotalStudents : 0;
    const simStudents = targetStudentCount * studentRatio;
    return acc + (simStudents * (curr.tuitionFee * tuitionMult));
  }, 0);

  const simMonthlyExpenses = (baseline.payroll.total * salaryMult) + (baseline.monthlyOverhead * overheadMult);
  const simNetProfit = simMonthlyRevenue - simMonthlyExpenses;

  // Weight average tuition per student for break-even calc
  const weightedAvgTuition = currentTotalStudents > 0 ? (currentMonthlyRevenue * tuitionMult) / currentTotalStudents : 0;
  const breakEvenStudents = weightedAvgTuition > 0 ? Math.ceil(simMonthlyExpenses / weightedAvgTuition) : 0;

  // Chart Data Generation (Linear Projection based on Student Count)
  const chartData = useMemo(() => {
    const data = [];
    const minRange = 0;
    const maxRange = Math.max(currentTotalStudents * 1.5, breakEvenStudents * 1.25, 50);
    const step = Math.max(Math.floor(maxRange / 10), 5);

    for (let s = minRange; s <= maxRange; s += step) {
      data.push({
        students: s,
        cost: simMonthlyExpenses, // Assuming fixed costs (all salaries + overhead are fixed for this simulation)
        revenue: Math.floor(s * weightedAvgTuition),
      });
    }
    return data;
  }, [simMonthlyExpenses, weightedAvgTuition, currentTotalStudents, breakEvenStudents]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Left Column: Controls */}
      <div className="xl:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
              <Calculator size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Simulation Controls</h2>
          </div>

          {/* Student Count Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <Users size={14} className="text-slate-400" /> Total Students
              </label>
              <span className="text-lg font-black text-indigo-600">{targetStudentCount}</span>
            </div>
            <input
              type="range"
              min="0"
              max={currentTotalStudents * 2 || 200}
              value={targetStudentCount}
              onChange={(e) => setTargetStudentCount(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Tuition Adjustment Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={14} className="text-slate-400" /> Tuition Fee adjustment
              </label>
              <span className={`text-lg font-black ${tuitionAdjust >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {tuitionAdjust > 0 ? "+" : ""}{tuitionAdjust}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="100"
              value={tuitionAdjust}
              onChange={(e) => setTuitionAdjust(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Salary Adjustment Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <TrendingDown size={14} className="text-slate-400" /> Salaries adjustment
              </label>
              <span className={`text-lg font-black ${salaryAdjust >= 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {salaryAdjust > 0 ? "+" : ""}{salaryAdjust}%
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="50"
              value={salaryAdjust}
              onChange={(e) => setSalaryAdjust(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Overhead Adjustment Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <Target size={14} className="text-slate-400" /> Overhead Costs
              </label>
              <span className={`text-lg font-black ${overheadAdjust >= 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {overheadAdjust > 0 ? "+" : ""}{overheadAdjust}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              value={overheadAdjust}
              onChange={(e) => setOverheadAdjust(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
            <div className="flex items-start gap-3">
              <Info size={16} className="text-indigo-500 mt-0.5 shrink-0" />
              <p className="text-xs text-indigo-700/80 leading-relaxed italic">
                Simulations are based on weighted averages of your current 
                {baseline.levels.length} grade levels. Salaries are treated as fixed costs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Middle & Right Column: Analytics */}
      <div className="xl:col-span-2 space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-100/50">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-100">Monthly Revenue</p>
            <h3 className="text-3xl font-black mt-2">${Math.floor(simMonthlyRevenue).toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-indigo-100">
              <ArrowRight size={12} /> Baseline: ${Math.floor(currentMonthlyRevenue).toLocaleString()}
            </div>
          </div>

          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Expenses</p>
            <h3 className="text-3xl font-black mt-2 text-slate-800">${Math.floor(simMonthlyExpenses).toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-500">
              <ArrowRight size={12} /> Baseline: ${Math.floor(currentMonthlyExpenses).toLocaleString()}
            </div>
          </div>

          <div className={`p-6 rounded-3xl text-white shadow-xl ${simNetProfit >= 0 ? "bg-emerald-500 shadow-emerald-100/50" : "bg-rose-500 shadow-rose-100/50"}`}>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Projected {simNetProfit >= 0 ? "Profit" : "Loss"}</p>
            <h3 className="text-3xl font-black mt-2">${Math.abs(Math.floor(simNetProfit)).toLocaleString()}</h3>
            <p className="mt-4 text-xs font-bold opacity-80">Margin: {simMonthlyRevenue > 0 ? ((simNetProfit / simMonthlyRevenue) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>

        {/* Chart Card */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                <Target size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 leading-none">Break-Even Analysis</h2>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Projected Revenue vs Fixed Costs</p>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 bg-indigo-500 rounded-full" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target for Stability</span>
              </div>
              <p className="text-xl font-black text-slate-800">
                {breakEvenStudents} <span className="text-xs font-bold text-slate-400">Students</span>
              </p>
            </div>
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="students" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  label={{ value: 'Number of Students', position: 'bottom', offset: -10, fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  labelStyle={{ fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}
                />
                <Legend iconType="circle" />
                
                {/* Fixed Cost Line */}
                <Line 
                  type="monotone" 
                  dataKey="cost" 
                  stroke="#ef4444" 
                  strokeWidth={3} 
                  dot={false} 
                  name="Operating Cost (Fixed)"
                />
                
                {/* Revenue Line */}
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#6366f1" 
                  strokeWidth={4} 
                  dot={false} 
                  name="Gross Revenue"
                />

                {/* Vertical Reference at current location? Maybe not for readability. 
                    Let's just show a dot at break-even if it's within range */}
                {breakEvenStudents <= chartData[chartData.length-1].students && (
                  <ReferenceDot 
                    x={breakEvenStudents} 
                    y={simMonthlyExpenses} 
                    r={6} 
                    fill="#10b981" 
                    stroke="white" 
                    strokeWidth={3} 
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Breakdown Table */}
        <div className="bg-white overflow-hidden rounded-3xl shadow-sm border border-slate-100">
           <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Per-Level Breakdown</h2>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 lg uppercase tracking-widest">Grade Level</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Baseline Fee</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Baseline Students</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Simulated Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {baseline.levels.map((level) => {
                    const studentRatio = currentTotalStudents > 0 ? level.studentCount / currentTotalStudents : 0;
                    const simLevelStudents = targetStudentCount * studentRatio;
                    const simLevelRevenue = simLevelStudents * (level.tuitionFee * tuitionMult);
                    
                    return (
                      <tr key={level.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700 text-sm">{level.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 text-center">${level.tuitionFee}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 text-center font-medium">{level.studentCount}</td>
                        <td className="px-6 py-4 text-sm text-indigo-600 font-bold text-right">
                          ${Math.floor(simLevelRevenue).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
}
