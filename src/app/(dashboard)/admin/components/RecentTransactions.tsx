import React from 'react';

interface Transaction {
  type: 'income' | 'expense';
  title: string;
  amount: number;
  date: Date;
  source: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

const RecentTransactions = ({ transactions }: RecentTransactionsProps) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-800">Recent Transactions</h3>
        <button className="text-xs font-bold text-indigo-500 hover:text-indigo-600 transition-colors uppercase tracking-wider">View All</button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {transactions.map((tx, idx) => (
          <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all group">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {tx.type === 'income' ? '↙' : '↗'}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-700 leading-tight">{tx.title}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{tx.source} • {tx.date.toLocaleDateString()}</span>
              </div>
            </div>
            <span className={`text-sm font-black ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {tx.type === 'income' ? '+' : ''}{tx.amount.toLocaleString()}
            </span>
          </div>
        ))}
        {transactions.length === 0 && <p className="text-sm text-slate-400 font-medium py-10 text-center">No transactions recorded yet.</p>}
      </div>
    </div>
  );
};

export default RecentTransactions;
