import React from 'react';

interface SmartInsightsProps {
  insights: string[];
}

const SmartInsights = ({ insights }: SmartInsightsProps) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-200">
          🧠
        </div>
        <h3 className="text-lg font-bold text-slate-800 tracking-tight">Smart Insights</h3>
      </div>
      <div className="space-y-4">
        {insights.map((insight, idx) => (
          <div key={idx} className="flex gap-4 items-start p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50 group hover:bg-indigo-50 transition-colors">
            <span className="text-lg">💡</span>
            <p className="text-sm font-medium text-slate-600 leading-relaxed">{insight}</p>
          </div>
        ))}
        <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center">
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">
             AI is analyzing {Math.floor(Math.random() * 50) + 10} more data points...
           </p>
        </div>
      </div>
    </div>
  );
};

export default SmartInsights;
