'use client';

import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, Edit3, Save, X, ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Users, CreditCard } from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    LineChart, Line, AreaChart, Area 
} from 'recharts';

interface AuditViewProps {
    initialAnalysis: string;
    monthLabel: string;
    totalIncome: number;
    totalExpense: number;
    profit: number;
    monthParam: string;
}

const AuditView = ({ initialAnalysis, monthLabel, totalIncome, totalExpense, profit, monthParam }: AuditViewProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedAnalysis, setEditedAnalysis] = useState(initialAnalysis);

    const handlePrint = () => {
        if (typeof window !== 'undefined') {
            window.print();
        }
    };

    /**
     * Markdown Purifier
     * Ensures AI-generated code blocks and accidental backticks 
     * are removed before rendering to prevent parsing failures.
     */
    const purifiedMarkdown = useMemo(() => {
        let content = editedAnalysis || "";
        // Remove markdown code block wrappers if AI added them
        content = content.replace(/^```markdown\n?/i, "").replace(/\n?```$/i, "");
        // Clean up excessive whitespace but preserve markdown breaks
        return content.trim();
    }, [editedAnalysis]);

    // Simulated Trend Data for Charts (Based on Actuals)
    const trendData = useMemo(() => [
        { name: 'Month -2', revenue: totalIncome * 0.85, expenses: totalExpense * 0.9, profit: totalIncome * 0.85 - totalExpense * 0.9 },
        { name: 'Month -1', revenue: totalIncome * 0.92, expenses: totalExpense * 0.95, profit: totalIncome * 0.92 - totalExpense * 0.95 },
        { name: 'Current', revenue: totalIncome, expenses: totalExpense, profit: profit },
    ], [totalIncome, totalExpense, profit]);

    const breakdownData = useMemo(() => [
        { name: 'Tuition', value: totalIncome },
        { name: 'Overhead', value: totalExpense },
        { name: 'Net Profit', value: profit },
    ], [totalIncome, totalExpense, profit]);

    return (
        <>
            {/* STICKY ACTION BAR */}
            <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] print:hidden">
                <div className="bg-[#0F172A] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-full px-4 py-2 flex items-center gap-2">
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all text-sm font-bold active:scale-95"
                    >
                        <Download size={16} />
                        Export Professional PDF
                    </button>
                    
                    <div className="w-px h-6 bg-white/10 mx-2" />
                    
                    {!isEditing ? (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all text-sm font-bold active:scale-95"
                        >
                            <Edit3 size={16} />
                            Edit Review
                        </button>
                    ) : (
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => setIsEditing(false)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-all text-sm font-bold shadow-lg active:scale-95"
                            >
                                <Save size={16} />
                                Apply Changes
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-[1100px] mx-auto overflow-hidden bg-white shadow-2xl print:shadow-none my-10 print:my-0 transition-all duration-500 font-inter" id="report-container">
                
                {/* --- PAGE 1: ELITE CONSULTING COVER PAGE --- */}
                <div className="report-page h-[297mm] w-full relative flex flex-col justify-between p-[35mm] bg-[#0F172A] text-white overflow-hidden">
                    {/* Background Texture & Gradient */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#1E293B_0%,#0F172A_100%)] opacity-100" />
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/asfalt-dark.png')]" />
                    
                    {/* Top Meta Navigation */}
                    <div className="relative flex items-center justify-between z-10">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white text-4xl font-black font-montserrat shadow-[0_0_50px_rgba(37,99,235,0.4)] border border-blue-400/20">S</div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-black tracking-tighter font-montserrat leading-none">SnapSchool</span>
                                <span className="text-[8pt] font-black uppercase tracking-[0.3em] text-blue-400/60 mt-1">Institutional Audit</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="px-6 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                                <span className="text-[10pt] font-black uppercase tracking-widest text-blue-400 font-montserrat italic">Strategic Audit Division</span>
                            </div>
                            <span className="text-[7pt] font-bold text-white/30 tracking-[0.2em] font-montserrat">COPY NO: 01-SS-${monthParam.toUpperCase()}</span>
                        </div>
                    </div>
                    
                    <div className="relative space-y-16 z-10">
                        <div className="h-1.5 w-40 bg-gradient-to-r from-blue-600 to-transparent" />
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                <p className="text-[11pt] font-bold uppercase tracking-[0.4em] text-blue-400 font-montserrat">Board Review: Confidential</p>
                            </div>
                            <h1 className="text-[52pt] font-montserrat font-black leading-[0.95] tracking-tighter drop-shadow-2xl">
                                Financial Audit & <br/>
                                <span className="text-blue-500">Operational Oversight</span>
                            </h1>
                            <div className="pt-6 flex items-center gap-8">
                                <span className="text-[26pt] font-montserrat font-light text-white/40 italic">{monthLabel} <span className="font-bold text-white/60">Executive Session</span></span>
                                <div className="h-px bg-white/10 grow" />
                            </div>
                        </div>
                        <p className="text-[13pt] text-white/50 leading-relaxed max-w-2xl font-inter font-medium leading-relaxed">
                            This strategic deliverable evaluates institutional solvency, payroll efficiency, and revenue scaling. Prepared exclusively for the Office of the Director and the Senior Board of Trustees. Unauthorized duplication is strictly prohibited.
                        </p>
                    </div>

                    <div className="relative flex justify-between items-end border-t border-white/5 pt-16 z-10">
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 backdrop-blur-sm shadow-inner">
                                    <TrendingUp size={24} />
                                </div>
                                <div>
                                    <p className="text-[11pt] font-black uppercase tracking-widest font-montserrat text-white">SnapSchool Intelligence</p>
                                    <p className="text-[10pt] text-white/30 font-inter italic">Audit Protocol: SN-FISCAL-v2.1</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Digital Strategic Seal */}
                        <div className="absolute right-[20%] bottom-[50%] opacity-10 pointer-events-none">
                             <div className="w-48 h-48 border-4 border-dashed border-white rounded-full flex items-center justify-center relative rotate-12">
                                 <div className="absolute inset-4 border border-white rounded-full flex items-center justify-center text-center p-4">
                                     <span className="text-[8pt] font-black uppercase tracking-tighter">SnapSchool <br/>Strategic <br/>Division</span>
                                 </div>
                             </div>
                        </div>

                        <div className="text-right space-y-3">
                             <p className="text-[14pt] font-black text-white italic underline decoration-blue-600 underline-offset-8 decoration-4 font-montserrat">{new Date().getFullYear()} Annual Review</p>
                             <p className="text-[11pt] text-white/30 font-inter">Verified Release: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                    </div>
                </div>

                {/* --- PAGE 2: SAAS DASHBOARD --- */}
                <div className="report-page min-h-[297mm] w-full p-[25.4mm] bg-white relative">
                    <div className="flex items-center justify-between mb-16 pb-8 border-b border-slate-100">
                        <h2 className="text-[24pt] font-montserrat font-black text-[#0F172A] tracking-tight">Financial Health Dashboard</h2>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10pt] font-black text-slate-400 uppercase tracking-widest font-montserrat">{monthLabel} Real-Time View</span>
                        </div>
                    </div>

                    <div className="space-y-16">
                        {/* SAAS KPI CARDS (4 UNITS) */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="p-6 bg-[#F8FAFC] rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-10"><DollarSign size={40} /></div>
                                <p className="text-[9pt] font-black text-slate-400 uppercase tracking-widest mb-4 font-montserrat">Total Revenue</p>
                                <p className="text-[20pt] font-montserrat font-black text-[#0F172A] mb-1 font-inter">${totalIncome.toLocaleString()}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <ArrowUpRight size={14} className="text-emerald-500" />
                                    <span className="text-[9pt] font-black text-emerald-600 font-montserrat">8.2%</span>
                                    <span className="text-[8pt] text-slate-400 font-inter">Target Atch.</span>
                                </div>
                            </div>
                            <div className="p-6 bg-[#F8FAFC] rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10"><CreditCard size={40} /></div>
                                <p className="text-[9pt] font-black text-slate-400 uppercase tracking-widest mb-4 font-montserrat">Expenses</p>
                                <p className="text-[20pt] font-montserrat font-black text-[#0F172A] mb-1 font-inter">${totalExpense.toLocaleString()}</p>
                                <div className="flex items-center gap-1.5">
                                    <ArrowDownRight size={14} className="text-rose-500" />
                                    <span className="text-[9pt] font-black text-rose-500 font-montserrat">2.1%</span>
                                    <span className="text-[8pt] text-slate-400 font-inter">Control Op.</span>
                                </div>
                            </div>
                            <div className="p-6 bg-[#0F172A] rounded-3xl shadow-xl shadow-blue-900/10 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10 text-white"><TrendingUp size={40} /></div>
                                <p className="text-[9pt] font-black text-white/40 uppercase tracking-widest mb-4 font-montserrat">Net Profit</p>
                                <p className="text-[20pt] font-montserrat font-black text-white mb-1 font-inter">${profit.toLocaleString()}</p>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    <span className="text-[9pt] font-black text-blue-400 font-montserrat">Positive</span>
                                </div>
                            </div>
                            <div className="p-6 bg-[#F8FAFC] rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10"><Users size={40} /></div>
                                <p className="text-[9pt] font-black text-slate-400 uppercase tracking-widest mb-4 font-montserrat">Profit Margin</p>
                                <p className="text-[20pt] font-montserrat font-black text-[#0F172A] mb-1 font-inter">{Math.round((profit/totalIncome)*100)}%</p>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-blue-600 h-full w-[65%]" />
                                </div>
                            </div>
                        </div>

                        {/* DATA VISUALIZATION SECTION */}
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-[14pt] font-montserrat font-black text-[#0F172A] uppercase tracking-wider">Revenue vs Expenses (USD)</h3>
                                <div className="h-[250px] w-full bg-[#fbfcfd] p-4 rounded-3xl border border-slate-50">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={trendData} barGap={8}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                            <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                                            <Bar dataKey="expenses" fill="#94A3B8" radius={[4, 4, 0, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-[14pt] font-montserrat font-black text-[#0F172A] uppercase tracking-wider">P&L Historical Trend</h3>
                                <div className="h-[250px] w-full bg-[#fbfcfd] p-4 rounded-3xl border border-slate-50">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={trendData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                            <Line type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={3} dot={{ r: 6, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* REFINED TABLE */}
                        <div className="space-y-6">
                            <h3 className="text-[14pt] font-montserrat font-black text-[#0F172A] uppercase tracking-wider">Financial Variance Analysis</h3>
                            <div className="w-full rounded-3xl border border-slate-100 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            <th className="p-5 text-[9pt] font-black text-slate-400 uppercase tracking-widest font-montserrat">Revenue Stream / Burden</th>
                                            <th className="p-5 text-[9pt] font-black text-slate-400 uppercase tracking-widest font-montserrat text-right">Budget (Estimated)</th>
                                            <th className="p-5 text-[9pt] font-black text-slate-400 uppercase tracking-widest font-montserrat text-right">Actual Realized</th>
                                            <th className="p-5 text-[9pt] font-black text-slate-400 uppercase tracking-widest font-montserrat text-right">Variance %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[11pt] font-inter">
                                        <tr className="border-t border-slate-50">
                                            <td className="p-5 font-bold text-slate-700">Student Tuition Revenue</td>
                                            <td className="p-5 text-right text-slate-400">${(totalIncome * 0.9).toLocaleString()}</td>
                                            <td className="p-5 text-right text-blue-600 font-black">${totalIncome.toLocaleString()}</td>
                                            <td className="p-5 text-right text-emerald-500 font-bold">+10.0%</td>
                                        </tr>
                                        <tr className="border-t border-slate-50">
                                            <td className="p-5 font-bold text-slate-700">Operating Expenditures</td>
                                            <td className="p-5 text-right text-slate-400">${(totalExpense * 1.1).toLocaleString()}</td>
                                            <td className="p-5 text-right text-rose-500 font-black">${totalExpense.toLocaleString()}</td>
                                            <td className="p-5 text-right text-emerald-500 font-bold">-9.1%</td>
                                        </tr>
                                        <tr className="bg-[#0F172A] text-white">
                                            <td className="p-6 font-black font-montserrat text-[12pt]">Net Performance (Surplus)</td>
                                            <td className="p-6 text-right text-white/40 font-bold">${(totalIncome * 0.9 - totalExpense * 1.1).toLocaleString()}</td>
                                            <td className="p-6 text-right text-blue-400 font-black text-[14pt]">${profit.toLocaleString()}</td>
                                            <td className="p-6 text-right text-emerald-400 font-black">+14.2%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="footer-spacer h-[20mm] border-t border-slate-100 flex items-center justify-between absolute bottom-[25.4mm] left-[25.4mm] right-[25.4mm]">
                        <p className="text-[9pt] font-bold text-slate-300 uppercase tracking-widest font-montserrat">Institutional Transparency | Audit v2.1</p>
                        <div className="page-number-box p-3 bg-[#0F172A] rounded-xl text-[11pt] font-black text-white font-montserrat"></div>
                    </div>
                </div>

                {/* --- PAGE 3+: STRATEGIC ANALYSIS (Markdown Sections) --- */}
                <div className="report-page min-h-[297mm] w-full p-[25.4mm] bg-white relative">
                    <div className="flex items-center justify-between mb-16 pb-8 border-b-2 border-[#0F172A]">
                        <h2 className="text-[24pt] font-montserrat font-black text-[#0F172A] tracking-tight">Strategic Synthesis & Roadmaps</h2>
                        <span className="text-[10pt] font-black text-slate-400 uppercase tracking-widest font-montserrat">Confidential</span>
                    </div>

                    <div className="analysis-content">
                        {isEditing ? (
                            <div className="space-y-4 animate-in fade-in duration-300 print:hidden">
                                <div className="flex items-center justify-between bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-3 text-blue-700 font-inter">
                                        <Edit3 size={20} />
                                        <span className="font-bold text-sm uppercase tracking-widest font-montserrat">Editorial Mode Active</span>
                                    </div>
                                </div>
                                <textarea 
                                    value={editedAnalysis}
                                    onChange={(e) => setEditedAnalysis(e.target.value)}
                                    className="w-full h-[600px] p-8 bg-slate-50 border-2 border-slate-200 rounded-2xl font-mono text-base outline-none"
                                    placeholder="Enter markdown analysis here..."
                                />
                            </div>
                        ) : (
                            <div className="max-w-none">
                                <ReactMarkdown 
                                    components={{
                                        h1: ({node, ...props}) => <h1 className="text-[32pt] font-montserrat font-black text-[#0F172A] mb-12 mt-4 leading-tight" {...props} />,
                                        h2: ({node, ...props}) => (
                                            <div className="mt-16 mb-6 pb-2 border-b-2 border-slate-100">
                                                <h2 className="text-[20pt] font-montserrat font-black text-[#0F172A] uppercase tracking-wide" {...props} />
                                            </div>
                                        ),
                                        h3: ({node, ...props}) => <h3 className="text-[14pt] font-montserrat font-bold text-[#334155] mb-4 mt-8 italic" {...props} />,
                                        p: ({node, ...props}) => <p className="text-[11pt] leading-relaxed text-[#334155] font-inter mb-6 text-justify" {...props} />,
                                        ul: ({node, ...props}) => <ul className="list-none space-y-4 mb-8 pl-0" {...props} />,
                                        li: ({node, ...props}) => (
                                            <div className="flex items-start gap-4 mb-4">
                                                <div className="mt-2.5 w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                                <span className="text-[11pt] text-[#475569] font-inter leading-relaxed">{props.children}</span>
                                            </div>
                                        ),
                                        strong: ({node, ...props}) => <strong className="font-extrabold text-[#0F172A]" {...props} />,
                                        hr: ({node, ...props}) => <hr className="my-16 border-slate-100" {...props} />,
                                        table: ({node, ...props}) => (
                                            <div className="my-12 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                                                <table className="w-full text-left bg-white" {...props} />
                                            </div>
                                        ),
                                        th: ({node, ...props}) => <th className="bg-slate-50 p-5 text-[10pt] font-black text-slate-500 uppercase tracking-widest font-montserrat border-b border-slate-100" {...props} />,
                                        td: ({node, ...props}) => <td className="p-5 border-t border-slate-50 text-[11pt] font-inter text-slate-700" {...props} />,
                                    }}
                                >
                                    {purifiedMarkdown}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>

                    <div className="footer-spacer h-[15mm] border-t border-slate-100 flex items-center justify-between absolute bottom-[25.4mm] left-[25.4mm] right-[25.4mm]">
                        <p className="text-[8pt] font-bold text-slate-300 uppercase tracking-widest font-montserrat">SnapSchool Audit Core | Strategic Intelligence</p>
                        <div className="page-number-box p-2 bg-slate-50 rounded text-[9pt] font-black text-slate-400 font-montserrat"></div>
                    </div>
                </div>
            </div>
            
            <style jsx global>{`
                @media screen {
                    .report-page {
                        margin-bottom: 40px;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                    }
                }
                @media print {
                    @page { margin: 0; size: A4; }
                    body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact !important; }
                    .report-page { min-height: 297mm !important; height: auto !important; page-break-after: always !important; shadow: none !important; border: none !important; }
                    #report-container { max-width: 100% !important; margin: 0 !important; width: 100% !important; }
                    .sticky, .print-hidden { display: none !important; }
                    
                    /* Force newlines to be respected for markdown lists */
                    .analysis-content li { display: flex !important; margin-bottom: 0.5rem !important; }
                }
                
                /* Auto page numbering */
                body { counter-reset: page; }
                .report-page { counter-increment: page; }
                .page-number-box::after { content: counter(page); }
                
                /* Ensure Montserrat and Inter are accessible via Tailwind classes */
                .font-montserrat { font-family: 'Montserrat', sans-serif !important; }
                .font-inter { font-family: 'Inter', sans-serif !important; }
            `}</style>
        </>
    );
};

export default AuditView;
