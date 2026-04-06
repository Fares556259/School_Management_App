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

    return (
        <div className="bg-white min-h-screen">
            {/* Auto-print script */}
            <script dangerouslySetInnerHTML={{ __html: `window.onload = () => { setTimeout(() => window.print(), 1000); }` }} />
            
            <div className="max-w-[1000px] mx-auto px-16 py-20 bg-white">
                {/* Header */}
                <div className="border-b-[10px] border-slate-900 pb-16 mb-20 flex justify-between items-end">
                    <div>
                        <h1 className="text-7xl font-black italic tracking-tighter uppercase mb-6 leading-none text-slate-900">Fiscal Audit</h1>
                        <div className="flex items-center gap-6">
                            <span className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-sm">Confidential</span>
                            <p className="text-base text-slate-500 font-bold uppercase tracking-[0.1em]">{report.month} Senior Review</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Audit Timestamp</p>
                        <p className="text-xl font-black italic text-slate-900">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                    </div>
                </div>

                {/* AI Analysis Content */}
                <div className="prose prose-slate max-w-none ai-report-container">
                    <div className="space-y-12 text-slate-800">
                        <ReactMarkdown 
                            components={{
                                h3: ({node, ...props}) => <h3 className="text-3xl font-black text-slate-900 mt-16 mb-8 uppercase tracking-tight border-l-[8px] border-indigo-600 pl-6 leading-none" {...props} />,
                                p: ({node, ...props}) => <p className="text-lg leading-relaxed text-slate-700 italic font-medium mb-6" {...props} />,
                                li: ({node, ...props}) => <li className="text-lg leading-relaxed text-slate-700 mb-2 list-none flex items-start gap-3 before:content-['→'] before:text-indigo-600 before:font-black" {...props} />,
                                ul: ({node, ...props}) => <ul className="pl-0 space-y-4 mb-8" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-black text-slate-900 underline decoration-indigo-200 decoration-4 underline-offset-4" {...props} />
                            }}
                        >
                            {aiAnalysis}
                        </ReactMarkdown>
                    </div>
                </div>

                {/* Signature Area for Authority */}
                <div className="mt-32 pt-20 border-t-2 border-slate-100 flex justify-between items-end">
                    <div className="space-y-8">
                        <div className="w-64 h-px bg-slate-300 mb-2" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lead Financial Auditor Signature</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] mb-4">
                            Automated School Audit Engine | SnapSchool AI Intelligence
                        </p>
                        <p className="text-[8px] font-bold text-slate-200 uppercase tracking-widest">
                            ID: {Math.random().toString(36).substring(7).toUpperCase()} / v1.50.INT
                        </p>
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { margin: 0; }
                    body { margin: 1.6cm; background: white; }
                    .no-print { display: none !important; }
                }
                .ai-report-container { font-family: 'Inter', sans-serif; }
            `}} />
        </div>
    );
};

export default AuditPage;
