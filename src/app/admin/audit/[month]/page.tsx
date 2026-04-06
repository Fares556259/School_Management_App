import React from 'react';
import { getFinancialReportData, getAIFinancialReport } from '../../../(dashboard)/admin/actions';
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AuditView from './AuditView';

export const dynamic = "force-dynamic";

const AuditPage = async ({ params }: { params: { month: string } }) => {
    const { userId } = auth();

    if (!userId) {
        return redirect("/sign-in");
    }

    // month will be like "April_2026"
    const monthLabel = decodeURIComponent(params.month).replace('_', ' ');
    
    let report;
    let aiAnalysis = "";
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
        <div className="bg-[#F1F5F9] min-h-screen text-[#1E293B] font-inter">
            {/* Fonts: Modern & Professional */}
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
            
            <AuditView 
                initialAnalysis={aiAnalysis}
                monthLabel={monthLabel}
                totalIncome={totalIncome}
                totalExpense={totalExpense}
                profit={profit}
                monthParam={params.month}
            />

            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap');
                
                .font-outfit { font-family: 'Outfit', sans-serif; }
                .font-inter { font-family: 'Inter', sans-serif; }
                
                body { line-height: 1.6; letter-spacing: -0.01em; }
            `}} />
        </div>
    );
};

export default AuditPage;
