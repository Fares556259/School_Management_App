import React from 'react';
import { getFinancialReportData, getAIFinancialReport } from '../../actions';
import ReactMarkdown from 'react-markdown';

export const dynamic = "force-dynamic";

const AuditPage = async ({ params }: { params: { month: string } }) => {
    // month will be like "April_2026"
    const monthLabel = decodeURIComponent(params.month).replace('_', ' ');
    
    let report;
    let aiAnalysis;
    let error = null;

    try {
        report = await getFinancialReportData(monthLabel);
        aiAnalysis = await getAIFinancialReport(report);
    } catch (e: any) {
        error = e.message;
    }

    if (error || !report) {
        return (
            <div className="p-20 text-center">
                <h1 className="text-2xl font-bold text-rose-500">Audit Generation Failed</h1>
                <p className="text-slate-500 mt-2">{error || "Could not retrieve report data."}</p>
            </div>
        );
    }

    const totalIncome = report.metrics.totalTuitionIncome + report.incomeBreakdown.reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpense = report.metrics.totalSalaryExpenses + report.metrics.totalGeneralExpenses;
    const profit = totalIncome - totalExpense;

    return (
        <div className="bg-[#F8FAFC] min-h-screen text-[#0F172A] font-inter">
            {/* Fonts */}
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
            
            {/* Auto-print script */}
            <script dangerouslySetInnerHTML={{ __html: `window.onload = () => { setTimeout(() => window.print(), 1500); }` }} />
            
            <div className="max-w-[1000px] mx-auto overflow-hidden bg-white shadow-2xl print:shadow-none my-10 print:my-0">
                
                {/* --- PAGE 1: COVER PAGE --- */}
                <div className="h-[1414px] w-full relative flex flex-col justify-center px-24 bg-white border-b-8 border-[#2563EB]">
                    <div className="absolute top-24 left-24 flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#2563EB] rounded-2xl flex items-center justify-center text-white text-2xl font-black">S</div>
                        <span className="text-2xl font-black tracking-tighter text-[#0F172A]">SnapSchool</span>
                    </div>
                    
                    <div className="space-y-8">
                        <span className="text-sm font-bold uppercase tracking-[0.4em] text-[#2563EB]">Fiscal Audit Review</span>
                        <h1 className="text-8xl font-playfair font-black leading-[0.9] text-[#0F172A]">
                            Financial Report – {monthLabel}
                        </h1>
                        <p className="text-2xl text-[#64748B] font-medium max-w-xl leading-relaxed italic">
                            Comprehensive performance analysis, operational audits, and strategic scalability roadmap.
                        </p>
                    </div>

                    <div className="mt-32 space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="px-4 py-1.5 bg-[#EF4444] text-white text-[10px] font-black uppercase tracking-widest rounded-full">Confidential</span>
                            <span className="text-sm font-bold text-[#64748B] uppercase tracking-widest">Internal Use Only</span>
                        </div>
                        <p className="text-lg font-bold text-[#0F172A]">Lead Analyst: SnapAssistant AI v1.50</p>
                    </div>

                    <div className="absolute bottom-24 left-24 right-24 flex justify-between items-end border-t border-slate-100 pt-12">
                        <div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] mb-2">Authority Level</p>
                            <p className="text-sm font-black text-[#0F172A] uppercase tracking-widest">Senior Financial Management</p>
                        </div>
                        <p className="text-sm font-bold text-slate-300">© 2026 SnapSchool Global</p>
                    </div>
                </div>

                {/* --- PAGE 2: EXECUTIVE SUMMARY --- */}
                <div className="min-h-[1414px] w-full px-24 py-24 bg-white border-b border-slate-100">
                    <div className="flex justify-between items-start mb-20">
                        <h2 className="text-4xl font-playfair font-black text-[#0F172A]">Executive Summary</h2>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1">Fiscal Period</p>
                            <p className="text-xl font-black text-[#2563EB] italic underline decoration-4 underline-offset-8 decoration-[#2563EB]/20">{monthLabel}</p>
                        </div>
                    </div>

                    {/* KPI CARDS */}
                    <div className="grid grid-cols-3 gap-8 mb-24">
                        <div className="p-8 bg-[#F8FAFC] rounded-[32px] border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Gross Revenue</span>
                                <span className="text-[#10B981] font-bold text-xs bg-[#10B981]/10 px-2 py-0.5 rounded-full">+12% vs LY</span>
                            </div>
                            <p className="text-4xl font-playfair font-black text-[#0F172A] italic">${totalIncome.toLocaleString()}</p>
                            <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-[#10B981] w-[85%]" />
                            </div>
                        </div>
                        <div className="p-8 bg-[#F8FAFC] rounded-[32px] border border-slate-100 space-y-4">
                            <span className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Total Expenses</span>
                            <p className="text-4xl font-playfair font-black text-[#0F172A] italic">${totalExpense.toLocaleString()}</p>
                            <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-[#EF4444] w-[65%]" />
                            </div>
                        </div>
                        <div className="p-8 bg-[#2563EB] rounded-[32px] shadow-xl shadow-blue-100 space-y-4">
                            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Net Profit</span>
                            <p className="text-4xl font-playfair font-black text-white italic">${profit.toLocaleString()}</p>
                            <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white w-[73%]" />
                            </div>
                        </div>
                    </div>

                    {/* AI ANALYSIS CONTENT START */}
                    <div className="prose prose-slate max-w-none">
                        <div className="space-y-16 text-slate-800">
                            <ReactMarkdown 
                                components={{
                                    h3: ({node, ...props}) => (
                                        <div className="mt-20 mb-10">
                                            <h3 className="text-4xl font-playfair font-black text-[#0F172A] mb-4" {...props} />
                                            <div className="h-1 w-24 bg-[#2563EB]" />
                                        </div>
                                    ),
                                    p: ({node, ...props}) => <p className="text-xl leading-relaxed text-[#0F172A] font-medium mb-8" {...props} />,
                                    ul: ({node, ...props}) => <ul className="list-none space-y-4 mb-8 pl-6" {...props} />,
                                    ol: ({node, ...props}) => <ol className="list-decimal space-y-8 mb-8 pl-6 marker:text-[#2563EB] marker:font-black" {...props} />,
                                    li: ({node, ...props}) => (
                                        <li className="relative group">
                                            <span className="text-[#0F172A] font-medium leading-relaxed block">{props.children}</span>
                                        </li>
                                    ),
                                    strong: ({node, children, ...props}) => {
                                        const text = String(children).toLowerCase();
                                        if (text.includes("growth") || text.includes("+")) {
                                            return <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-black bg-[#10B9811A] text-[#10B981] mx-1">🟢 {children}</span>;
                                        }
                                        if (text.includes("risk") || text.includes("issue")) {
                                            return <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-black bg-[#EF44441A] text-[#EF4444] mx-1">🔴 {children}</span>;
                                        }
                                        return <strong className="font-black text-[#0F172A] bg-yellow-50 px-1 rounded-sm" {...props}>{children}</strong>;
                                    },
                                    hr: ({node, ...props}) => <hr className="my-20 border-slate-100" {...props} />,
                                    blockquote: ({node, children, ...props}) => (
                                        <div className="p-10 bg-[#F8FAFC] border-r-8 border-[#2563EB] rounded-3xl my-12 shadow-sm overflow-hidden">
                                            <p className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest mb-6 flex items-center gap-2">
                                                <span className="text-lg">🧠</span> AI Strategic Insight
                                            </p>
                                            <div className="text-xl italic font-serif text-[#0F172A] leading-relaxed">
                                                {children}
                                            </div>
                                        </div>
                                    )
                                }}
                            >
                                {aiAnalysis}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* --- SIGNATURE / FOOTER --- */}
                <div className="px-24 py-20 bg-[#F8FAFC] flex justify-between items-center border-t border-slate-100">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-full bg-slate-200 border-4 border-white flex items-center justify-center text-slate-400">
                            ID
                        </div>
                        <div>
                            <div className="w-48 h-px bg-slate-300 mb-2" />
                            <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Auditor Authentication</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                            ID: {Math.random().toString(36).substring(7).toUpperCase()} / v1.50.BCG
                        </p>
                        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.5em]">
                            Automated School Audit Engine | SnapSchool AI
                        </p>
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,900&family=Inter:wght@400;500;600;700;800;900&display=swap');
                
                .font-playfair { font-family: 'Playfair Display', serif; }
                .font-inter { font-family: 'Inter', sans-serif; }
                
                @media print {
                    @page { margin: 0; size: A4; }
                    body { margin: 0; background: white; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .h-[1414px], .min-h-[1414px] { height: 297mm !important; min-height: 297mm !important; page-break-after: always; }
                    .shadow-2xl { box-shadow: none !important; }
                    .max-w-[1000px] { max-width: 100% !important; margin: 0 !important; }
                }
                
                .prose blockquote p { margin: 0 !important; }
                body { line-height: 1.5; }
            `}} />
        </div>
    );
};

export default AuditPage;
